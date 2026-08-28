/** ICC tag table lookup, shared by every reader in this directory. */

const TAG_TABLE_OFFSET = 128;

export function ascii(data: Buffer, offset: number, length: number): string {
  return data.subarray(offset, offset + length).toString('latin1').trim();
}

/** The bytes of a named tag, or null if the profile does not carry it. */
export function findIccTag(data: Buffer, wanted: string): Buffer | null {
  if (data.length < TAG_TABLE_OFFSET + 4) return null;
  const count = data.readUInt32BE(TAG_TABLE_OFFSET);

  for (let i = 0; i < count; i += 1) {
    const entry = TAG_TABLE_OFFSET + 4 + i * 12;
    if (entry + 12 > data.length) break;
    if (ascii(data, entry, 4) !== wanted) continue;

    const offset = data.readUInt32BE(entry + 4);
    const size = data.readUInt32BE(entry + 8);
    if (offset + size > data.length) return null;
    return data.subarray(offset, offset + size);
  }
  return null;
}
