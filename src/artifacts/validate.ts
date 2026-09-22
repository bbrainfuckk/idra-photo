import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { IdraError } from '../core/errors.js';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ImageInfo {
  format: ImageFormat;
  extension: 'png' | 'jpg' | 'webp';
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

export interface ImageLimits {
  maxBytes: number;
  maxSide: number;
  maxPixels: number;
  minSide: number;
}

export const DEFAULT_LIMITS: ImageLimits = {
  maxBytes: 32 * 1024 * 1024,
  maxSide: 8192,
  maxPixels: 64 * 1024 * 1024,
  minSide: 16,
};

/**
 * Validate that a path is a regular, non-empty PNG/JPEG/WebP within byte and pixel limits.
 * PNG: every chunk CRC is checked and the image stream is fully decompressed and size-checked.
 * JPEG and WebP: container structure and dimensions are checked; entropy data is not decoded.
 * None of this proves the image looks right.
 */
export function validateImageFile(filePath: string, limits: ImageLimits = DEFAULT_LIMITS): ImageInfo {
  let st: fs.Stats;
  try {
    st = fs.lstatSync(filePath);
  } catch {
    throw new IdraError('ARTIFACT_INVALID', 'artifact file does not exist', { path: filePath, reason: 'missing' });
  }
  if (st.isSymbolicLink()) throw new IdraError('ARTIFACT_INVALID', 'artifact must not be a symlink', { path: filePath, reason: 'symlink' });
  if (!st.isFile()) throw new IdraError('ARTIFACT_INVALID', 'artifact is not a regular file', { path: filePath, reason: 'not_regular' });
  if (st.size === 0) throw new IdraError('ARTIFACT_INVALID', 'artifact is empty', { path: filePath, reason: 'empty' });
  if (st.size > limits.maxBytes) {
    throw new IdraError('ARTIFACT_INVALID', `artifact exceeds ${limits.maxBytes} bytes`, { path: filePath, reason: 'too_large', bytes: st.size });
  }
  const buf = fs.readFileSync(filePath);
  const info = validateImageBuffer(buf, limits);
  return info;
}

export function validateImageBuffer(buf: Buffer, limits: ImageLimits = DEFAULT_LIMITS): ImageInfo {
  let dims: { format: ImageFormat; width: number; height: number };
  if (isPng(buf)) dims = parsePng(buf, limits);
  else if (isJpeg(buf)) dims = parseJpeg(buf);
  else if (isWebp(buf)) dims = parseWebp(buf);
  else throw new IdraError('ARTIFACT_INVALID', 'unsupported or unrecognized image type (png, jpeg, webp only)', { reason: 'unsupported_type' });

  if (dims.width < limits.minSide || dims.height < limits.minSide) {
    throw new IdraError('ARTIFACT_INVALID', 'image is smaller than the minimum size', { reason: 'too_small', width: dims.width, height: dims.height });
  }
  if (dims.width > limits.maxSide || dims.height > limits.maxSide || dims.width * dims.height > limits.maxPixels) {
    throw new IdraError('ARTIFACT_INVALID', 'image exceeds pixel limits', { reason: 'too_many_pixels', width: dims.width, height: dims.height });
  }
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return {
    format: dims.format,
    extension: dims.format === 'jpeg' ? 'jpg' : dims.format,
    width: dims.width,
    height: dims.height,
    bytes: buf.length,
    sha256,
  };
}

function isPng(b: Buffer): boolean {
  return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
}
function isJpeg(b: Buffer): boolean {
  return b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}
function isWebp(b: Buffer): boolean {
  return b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer, start = 0, end = buf.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function checkDims(width: number, height: number, limits: ImageLimits): void {
  if (width > limits.maxSide || height > limits.maxSide || width * height > limits.maxPixels) {
    throw new IdraError('ARTIFACT_INVALID', 'image exceeds pixel limits', { reason: 'too_many_pixels', width, height });
  }
}

const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Size of the decompressed PNG image stream, including one filter byte per scanline. */
function pngExpectedBytes(width: number, height: number, bitsPerPixel: number, interlaced: boolean): number {
  const rowBytes = (w: number) => Math.ceil((w * bitsPerPixel) / 8) + 1;
  if (!interlaced) return height * rowBytes(width);
  const passes = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2],
  ];
  let total = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((width - x0!) / dx!);
    const ph = Math.ceil((height - y0!) / dy!);
    if (pw > 0 && ph > 0) total += ph * rowBytes(pw);
  }
  return total;
}

function parsePng(b: Buffer, limits: ImageLimits): { format: 'png'; width: number; height: number } {
  let off = 8;
  let width = 0;
  let height = 0;
  let bitsPerPixel = 0;
  let interlaced = false;
  const idat: Buffer[] = [];
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;
  let first = true;
  while (off + 12 <= b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('ascii', off + 4, off + 8);
    if (off + 12 + len > b.length) throw bad('png_chunk_truncated', { type });
    const expected = b.readUInt32BE(off + 8 + len);
    const actual = crc32(b, off + 4, off + 8 + len);
    if (expected !== actual) throw bad('png_crc_mismatch', { type });
    if (first) {
      if (type !== 'IHDR' || len !== 13) throw bad('png_missing_ihdr');
      width = b.readUInt32BE(off + 8);
      height = b.readUInt32BE(off + 12);
      const bitDepth = b[off + 16]!;
      const colorType = b[off + 17]!;
      if (![1, 2, 4, 8, 16].includes(bitDepth) || ![0, 2, 3, 4, 6].includes(colorType)) throw bad('png_bad_ihdr');
      if (width === 0 || height === 0) throw bad('png_zero_dimension');
      checkDims(width, height, limits);
      bitsPerPixel = bitDepth * PNG_CHANNELS[colorType]!;
      interlaced = b[off + 20] === 1;
      sawIhdr = true;
      first = false;
    } else if (type === 'IDAT') {
      sawIdat = true;
      idat.push(b.subarray(off + 8, off + 8 + len));
    } else if (type === 'IEND') {
      sawIend = true;
      off += 12 + len;
      break;
    }
    off += 12 + len;
  }
  if (!sawIhdr || !sawIdat || !sawIend) throw bad('png_incomplete', { sawIhdr, sawIdat, sawIend });
  if (off !== b.length) throw bad('png_trailing_bytes');
  // Decode the compressed image stream and check it holds exactly the expected scanlines.
  const expected = pngExpectedBytes(width, height, bitsPerPixel, interlaced);
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: expected + 1 });
  } catch {
    throw bad('png_data_not_decodable');
  }
  if (raw.length !== expected) throw bad('png_data_size_mismatch', { expected, actual: raw.length });
  if (!interlaced) {
    const stride = Math.ceil((width * bitsPerPixel) / 8) + 1;
    for (let r = 0; r < height; r++) if (raw[r * stride]! > 4) throw bad('png_bad_filter_type', { row: r });
  }
  return { format: 'png', width, height };
}

function parseJpeg(b: Buffer): { format: 'jpeg'; width: number; height: number } {
  let off = 2;
  let width = 0;
  let height = 0;
  let sawSof = false;
  let sawSos = false;
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) throw bad('jpeg_marker_expected', { offset: off });
    const marker = b[off + 1]!;
    if (marker === 0xff) {
      off += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      off += 2;
      continue;
    }
    if (marker === 0xd9) break;
    const len = b.readUInt16BE(off + 2);
    if (len < 2 || off + 2 + len > b.length) throw bad('jpeg_segment_truncated', { marker });
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof && !sawSof) {
      if (len < 7) throw bad('jpeg_sof_short');
      height = b.readUInt16BE(off + 5);
      width = b.readUInt16BE(off + 7);
      sawSof = true;
    }
    if (marker === 0xda) {
      sawSos = true;
      break;
    }
    off += 2 + len;
  }
  if (!sawSof || !sawSos) throw bad('jpeg_incomplete', { sawSof, sawSos });
  if (!(b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9)) throw bad('jpeg_missing_eoi');
  if (width === 0 || height === 0) throw bad('jpeg_zero_dimension');
  return { format: 'jpeg', width, height };
}

function parseWebp(b: Buffer): { format: 'webp'; width: number; height: number } {
  const riffSize = b.readUInt32LE(4);
  if (riffSize + 8 !== b.length && riffSize + 8 !== b.length - 1) throw bad('webp_riff_size_mismatch', { riffSize, bytes: b.length });
  let off = 12;
  let width = 0;
  let height = 0;
  let found = false;
  while (off + 8 <= b.length) {
    const fourcc = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const dataStart = off + 8;
    if (dataStart + size > b.length) throw bad('webp_chunk_truncated', { fourcc });
    if (fourcc === 'VP8X' && size >= 10) {
      width = 1 + b.readUIntLE(dataStart + 4, 3);
      height = 1 + b.readUIntLE(dataStart + 7, 3);
      found = true;
      break;
    }
    if (fourcc === 'VP8L' && size >= 5) {
      if (b[dataStart] !== 0x2f) throw bad('webp_vp8l_signature');
      const bits = b.readUInt32LE(dataStart + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
      found = true;
      break;
    }
    if (fourcc === 'VP8 ' && size >= 10) {
      if (!(b[dataStart + 3] === 0x9d && b[dataStart + 4] === 0x01 && b[dataStart + 5] === 0x2a)) throw bad('webp_vp8_start_code');
      width = b.readUInt16LE(dataStart + 6) & 0x3fff;
      height = b.readUInt16LE(dataStart + 8) & 0x3fff;
      found = true;
      break;
    }
    off = dataStart + size + (size % 2);
  }
  if (!found || width === 0 || height === 0) throw bad('webp_no_dimensions');
  return { format: 'webp', width, height };
}

function bad(reason: string, details: Record<string, unknown> = {}): IdraError {
  return new IdraError('ARTIFACT_INVALID', `image is not structurally valid (${reason})`, { reason, ...details });
}

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function aspectString(width: number, height: number): string {
  const g = gcd(width, height);
  return `${width / g}:${height / g}`;
}

/** Compare a requested aspect such as "4:5" with actual dimensions using a 1% tolerance. */
export function aspectMatches(requested: string | null, width: number, height: number): boolean | null {
  if (!requested) return null;
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(requested.trim());
  if (!m) return null;
  const want = Number(m[1]) / Number(m[2]);
  const got = width / height;
  return Math.abs(want - got) / want <= 0.01;
}
