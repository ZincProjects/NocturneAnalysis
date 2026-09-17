import { deflateSync, inflateSync } from "node:zlib";

/**
 * A minimal PNG codec for 8-bit RGB images, enough to build and check the
 * steganography challenge without an image library. Only filter type 0 is
 * written; only filter type 0 is read, which is all this module ever writes.
 */

export interface RgbImage {
  width: number;
  height: number;
  /** width * height * 3 bytes, row-major, R G B. */
  pixels: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng(image: RgbImage): Buffer {
  const { width, height, pixels } = image;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 3, width * 3).copy(raw, row + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function decodePng(file: Buffer): RgbImage {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 2) throw new Error("Only 8-bit RGB is supported");
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    if (raw[row] !== 0) throw new Error("Only filter type 0 is supported");
    pixels.set(raw.subarray(row + 1, row + 1 + width * 3), y * width * 3);
  }
  return { width, height, pixels };
}

/**
 * Writes `message` plus a NUL terminator into bit 0 of each channel value,
 * in R, G, B order, pixel by pixel left to right and top to bottom. Each byte
 * is written most significant bit first. zsteg reports this as `b1,rgb,msb,xy`.
 */
export function embedLsb(image: RgbImage, message: string): RgbImage {
  const bytes = Buffer.concat([Buffer.from(message, "utf8"), Buffer.from([0])]);
  if (bytes.length * 8 > image.pixels.length) throw new Error("Message does not fit");
  const pixels = Uint8Array.from(image.pixels);
  bytes.forEach((byte, i) => {
    for (let bit = 0; bit < 8; bit += 1) {
      const value = (byte >> (7 - bit)) & 1;
      const index = i * 8 + bit;
      pixels[index] = (pixels[index] & 0xfe) | value;
    }
  });
  return { ...image, pixels };
}

export function extractLsb(image: RgbImage): string {
  const out: number[] = [];
  for (let i = 0; i + 8 <= image.pixels.length; i += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | (image.pixels[i + bit] & 1);
    if (byte === 0) break;
    out.push(byte);
  }
  return Buffer.from(out).toString("utf8");
}
