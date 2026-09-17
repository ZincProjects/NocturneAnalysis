/** Caesar shift over a-z and A-Z; everything else passes through unchanged. */
export function caesarShift(text: string, shift: number): string {
  const k = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + k) % 26) + base);
  });
}

function xorBytes(bytes: Uint8Array, key: number): Buffer {
  return Buffer.from(bytes.map((byte) => byte ^ key));
}

/** XORs every byte of `text` with one key byte and returns lowercase hex. */
export function singleByteXorHex(text: string, key: number): string {
  return xorBytes(Buffer.from(text, "utf8"), key).toString("hex");
}

export function singleByteXorDecodeHex(hex: string, key: number): string {
  return xorBytes(Buffer.from(hex, "hex"), key).toString("utf8");
}
