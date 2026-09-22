import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { validateImageBuffer, validateImageFile, aspectMatches, aspectString, crc32 } from '../../src/artifacts/validate.js';
import { makeJpegContainer, makePng } from '../../src/sim/fixtures.js';
import { tmpWorkspace } from '../helpers.js';

const code = (fn: () => unknown) => {
  try {
    fn();
    return 'none';
  } catch (e) {
    return (e as { details?: { reason?: string } }).details?.reason ?? (e as Error).message;
  }
};

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

test('valid PNG decodes with dimensions and hash', () => {
  const info = validateImageBuffer(makePng(64, 80, 3));
  assert.equal(info.format, 'png');
  assert.equal(info.extension, 'png');
  assert.equal(info.width, 64);
  assert.equal(info.height, 80);
  assert.match(info.sha256, /^[0-9a-f]{64}$/);
});

test('corrupt PNGs are rejected', () => {
  const good = makePng(32, 32, 1);
  const truncated = good.subarray(0, good.length - 20);
  assert.equal(code(() => validateImageBuffer(truncated)), 'png_chunk_truncated');
  const flipped = Buffer.from(good);
  flipped[40] = flipped[40]! ^ 0xff;
  assert.match(code(() => validateImageBuffer(flipped)), /png_crc_mismatch|png_data/);
  const trailing = Buffer.concat([good, Buffer.from('junk')]);
  assert.equal(code(() => validateImageBuffer(trailing)), 'png_trailing_bytes');
});

test('PNG with CRC-valid but undecodable image data is rejected', () => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(32, 0);
  ihdr.writeUInt32BE(32, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const garbage = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', Buffer.from('not zlib at all')), chunk('IEND', Buffer.alloc(0))]);
  assert.equal(code(() => validateImageBuffer(garbage)), 'png_data_not_decodable');
  const short = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc(10))), chunk('IEND', Buffer.alloc(0))]);
  assert.equal(code(() => validateImageBuffer(short)), 'png_data_size_mismatch');
});

test('decompression bomb dimensions are rejected before inflating', () => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(60000, 0);
  ihdr.writeUInt32BE(60000, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const bomb = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc(100))), chunk('IEND', Buffer.alloc(0))]);
  assert.equal(code(() => validateImageBuffer(bomb)), 'too_many_pixels');
});

test('JPEG container is detected as jpeg with a .jpg extension', () => {
  const info = validateImageBuffer(makeJpegContainer(40, 30));
  assert.equal(info.format, 'jpeg');
  assert.equal(info.extension, 'jpg');
  assert.deepEqual([info.width, info.height], [40, 30]);
  assert.match(code(() => validateImageBuffer(makeJpegContainer(40, 30).subarray(0, 60))), /^jpeg_/);
});

test('WebP lossless header is parsed', () => {
  const body = Buffer.alloc(5);
  body[0] = 0x2f;
  body.writeUInt32LE(((50 - 1) << 14) | (40 - 1), 1);
  const vp8l = Buffer.concat([Buffer.from('VP8L'), Buffer.from([5, 0, 0, 0]), body, Buffer.from([0])]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0);
  riff.writeUInt32LE(4 + vp8l.length, 4);
  const webp = Buffer.concat([riff, Buffer.from('WEBP'), vp8l]);
  const info = validateImageBuffer(webp);
  assert.deepEqual([info.format, info.width, info.height], ['webp', 40, 50]);
});

test('non-images, empty files, oversized files, and tiny images are rejected', () => {
  const ws = tmpWorkspace();
  const txt = path.join(ws, 'a.png');
  fs.writeFileSync(txt, 'hello, I am text');
  assert.equal(code(() => validateImageFile(txt)), 'unsupported_type');
  const empty = path.join(ws, 'b.png');
  fs.writeFileSync(empty, '');
  assert.equal(code(() => validateImageFile(empty)), 'empty');
  const big = path.join(ws, 'c.png');
  fs.writeFileSync(big, makePng(64, 64, 1));
  assert.equal(code(() => validateImageFile(big, { maxBytes: 100, maxSide: 8192, maxPixels: 1e8, minSide: 16 })), 'too_large');
  assert.equal(code(() => validateImageBuffer(makePng(8, 8, 1))), 'too_small');
  assert.equal(code(() => validateImageFile(path.join(ws, 'missing.png'))), 'missing');
  assert.equal(code(() => validateImageFile(ws)), 'not_regular');
});

test('aspect ratio is compared, never forced', () => {
  assert.equal(aspectString(1024, 1280), '4:5');
  assert.equal(aspectMatches('4:5', 1024, 1280), true);
  assert.equal(aspectMatches('4:5', 1024, 1024), false);
  assert.equal(aspectMatches(null, 10, 10), null);
});
