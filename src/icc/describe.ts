/** Minimal ICC v2/v4 header + `desc` tag reader, used for reporting only. */

import { ascii, findIccTag } from './tags.js';

export interface IccSummary {
  size: number;
  version: string;
  deviceClass: string;
  colorSpace: string;
  connectionSpace: string;
  description: string;
}

const HEADER_SIZE = 128;

/** ICC v4 multi-localized unicode: UTF-16BE records. */
function readMluc(tag: Buffer): string {
  const count = tag.readUInt32BE(8);
  if (count === 0) return '';
  const length = tag.readUInt32BE(20);
  const offset = tag.readUInt32BE(24);
  // Copy first: swap16 mutates in place, and `tag` is a view into the caller's
  // profile buffer, which must stay byte-exact for embedding.
  const utf16be = Buffer.from(tag.subarray(offset, offset + length));
  return utf16be.swap16().toString('utf16le').replace(/\0+$/, '');
}

/** ICC v2 textDescription: 7-bit ASCII count followed by the string. */
function readTextDescription(tag: Buffer): string {
  const length = tag.readUInt32BE(8);
  return tag.subarray(12, 12 + length).toString('latin1').replace(/\0+$/, '');
}

function readDescription(data: Buffer): string {
  const tag = findIccTag(data, 'desc');
  if (!tag || tag.length < 12) return '(no description tag)';
  const type = ascii(tag, 0, 4);
  if (type === 'mluc') return readMluc(tag);
  if (type === 'desc') return readTextDescription(tag);
  return `(unsupported desc type ${type})`;
}

export function summarizeIcc(data: Buffer): IccSummary {
  if (data.length < HEADER_SIZE) throw new Error('ICC profile is truncated');
  if (ascii(data, 36, 4) !== 'acsp') throw new Error('Not an ICC profile: missing acsp signature');

  return {
    size: data.readUInt32BE(0),
    version: `${data.readUInt8(8)}.${data.readUInt8(9) >> 4}.${data.readUInt8(9) & 0x0f}`,
    deviceClass: ascii(data, 12, 4),
    colorSpace: ascii(data, 16, 4),
    connectionSpace: ascii(data, 20, 4),
    description: readDescription(data),
  };
}
