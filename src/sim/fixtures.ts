import { deflateSync } from 'node:zlib';
import { crc32 } from '../artifacts/validate.js';

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Deterministic RGB PNG. Different seeds give different bytes. SIMULATION FIXTURE ONLY. */
export function makePng(width: number, height: number, seed: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      raw[o++] = (x * 7 + seed * 31) & 0xff;
      raw[o++] = (y * 5 + seed * 17) & 0xff;
      raw[o++] = (x + y + seed * 13) & 0xff;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * A structurally valid baseline-JPEG container (SOI, APP0, DQT, SOF0, SOS, EOI) used to test
 * format detection and extension handling. It is not a viewable photo. SIMULATION FIXTURE ONLY.
 */
export function makeJpegContainer(width: number, height: number): Buffer {
  const seg = (marker: number, body: Buffer) => {
    const h = Buffer.alloc(4);
    h[0] = 0xff;
    h[1] = marker;
    h.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([h, body]);
  };
  const app0 = Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const dqt = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 1)]);
  const sof = Buffer.alloc(15);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = 3;
  sof.set([1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], 6);
  const sos = Buffer.from([3, 1, 0x00, 2, 0x11, 3, 0x11, 0x00, 0x3f, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, app0), seg(0xdb, dqt), seg(0xc0, sof), seg(0xda, sos), Buffer.from([0x12, 0x34, 0x56, 0x78]), Buffer.from([0xff, 0xd9])]);
}
