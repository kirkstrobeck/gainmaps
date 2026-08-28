import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

import { flagString, parseArgs } from '../src/cli/args.js';
import { measureEdges } from '../src/color/edge-report.js';
import { codesAt, opaque, scanEdges } from '../src/color/edge-scan.js';
import { measureGamutDistance, suggestedAmount } from '../src/color/gamut-distance.js';
import { deltaChroma, deltaE76, xyzToLab } from '../src/color/lab.js';
import { applyMatrix, SRGB_TO_XYZ, type Triplet } from '../src/color/matrices.js';
import { softenEdges } from '../src/color/soften.js';
import { CURVES, INVERSE_CURVES, linearToBt2020, linearToSrgb, nitsToPq } from '../src/color/transfer.js';
import { assign } from '../src/commands/assign.js';
import { edges } from '../src/commands/edges.js';
import { extract } from '../src/commands/extract.js';
import { inspect } from '../src/commands/inspect.js';
import { soften } from '../src/commands/soften.js';
import { summarizeIcc } from '../src/icc/describe.js';
import { readIccXyzTag, sameGamut } from '../src/icc/primaries.js';
import { ascii, findIccTag } from '../src/icc/tags.js';
import { codecFor } from '../src/image/registry.js';
import { jpegCodec } from '../src/image/jpeg-codec.js';
import { pngCodec } from '../src/image/png-codec.js';
import { APP0, APP1, APP2, EOI, RST_FIRST, SOI, TEM, isStandalone, isTerminal, markerName } from '../src/jpeg/markers.js';
import { extractIccProfile, setIccProfile } from '../src/jpeg/icc-segments.js';
import { lumaQuantizationAverage, readFrameInfo } from '../src/jpeg/dimensions.js';
import { MAX_SEGMENT_PAYLOAD, parseJpeg, serializeJpeg, type JpegStructure } from '../src/jpeg/structure.js';
import { colorChunkInsertionPoint, parsePng, pngDimensions, serializePng, type Chunk } from '../src/png/chunks.js';
import { decodePng, pixelAt, type RasterImage } from '../src/png/decode.js';
import { encodeIdat, replacePixels } from '../src/png/encode.js';
import { bestFilteredRow, filterRow } from '../src/png/filter.js';
import { extractIccFromPng, pngPixelPayload, setIccInPng } from '../src/png/icc-chunk.js';
import { PRESETS } from '../src/profile/presets.js';
import { resolveProfile, readProfileFromImage } from '../src/profile/resolve.js';

import { HEIGHT, WIDTH, syntheticJpeg, syntheticRgbaPng, writeSyntheticCliFixtures } from './synthetic-cli-fixtures.js';

const PQ = 'profiles/rec2020-pq.icc';
const GAMUT = 'profiles/rec2020.icc';

const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function minimalPng(
  width: number,
  height: number,
  colorType: number,
  channels: number,
  rows: Buffer,
  patchIhdr?: (ihdr: Buffer) => void,
): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(colorType, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  patchIhdr?.(ihdr);
  return serializePng([
    { type: 'IHDR', data: ihdr },
    { type: 'IDAT', data: deflateSync(rows.length ? rows : Buffer.alloc(height * (width * channels + 1))) },
    { type: 'IEND', data: Buffer.alloc(0) },
  ]);
}

function flatPng(path: string): Promise<void> {
  const image: RasterImage = { width: 4, height: 4, channels: 3, pixels: Buffer.alloc(4 * 4 * 3, 128) };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  return writeFile(path, serializePng([
    { type: 'IHDR', data: ihdr },
    { type: 'IDAT', data: encodeIdat(image) },
    { type: 'IEND', data: Buffer.alloc(0) },
  ]));
}

function jpegWithSegments(segments: JpegStructure['segments'], scan = Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])) {
  return serializeJpeg({ segments, scan });
}

function framePayload(width: number, height: number, factor: number, components = 3) {
  const payload = Buffer.alloc(6 + components * 3);
  payload.writeUInt8(8, 0);
  payload.writeUInt16BE(height, 1);
  payload.writeUInt16BE(width, 3);
  payload.writeUInt8(components, 5);
  payload.writeUInt8(1, 6);
  payload.writeUInt8(factor, 7);
  return payload;
}

function dqtPayload(value: number, precision = 0) {
  const payload = Buffer.alloc(precision === 0 ? 65 : 129);
  payload.writeUInt8(precision << 4, 0);
  for (let i = 0; i < 64; i += 1) {
    if (precision === 0) payload.writeUInt8(value, 1 + i);
    else payload.writeUInt16BE(value, 1 + i * 2);
  }
  return payload;
}

function profileWithDesc(tagType: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(128);
  header.writeUInt32BE(128 + 4 + 12 + payload.length, 0);
  header.writeUInt8(4, 8);
  header.writeUInt8(0x40, 9);
  header.write('mntr', 12, 'latin1');
  header.write('RGB ', 16, 'latin1');
  header.write('XYZ ', 20, 'latin1');
  header.write('acsp', 36, 'latin1');
  const table = Buffer.alloc(16);
  table.writeUInt32BE(1, 0);
  table.write('desc', 4, 'latin1');
  table.writeUInt32BE(128 + 16, 8);
  table.writeUInt32BE(payload.length, 12);
  const tag = Buffer.from(payload);
  tag.write(tagType, 0, 'latin1');
  return Buffer.concat([header, table, tag]);
}

describe('cli args', () => {
  it('parses aliases, equals flags, booleans, and missing values', () => {
    const parsed = parseArgs(['assign', 'in.png', '-o', 'out.png', '--preset=gamut', '--help']);
    assert.deepEqual(parsed.positionals, ['assign', 'in.png']);
    assert.equal(flagString(parsed.flags, 'out'), 'out.png');
    assert.equal(flagString(parsed.flags, 'preset'), 'gamut');
    assert.equal(parsed.flags.help, true);
    assert.equal(flagString({}, 'missing'), undefined);
    assert.throws(() => flagString({ out: true }, 'out'), /requires a value/);
  });
});

describe('commands', () => {
  let logs: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logs.mockRestore();
  });

  it('assigns, extracts, inspects, edges, and softens while preserving encoded payload invariants', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hdr-lab-'));
    const { png: PNG, jpeg: JPEG, donor: DONOR } = await writeSyntheticCliFixtures();
    const pngOut = await assign(PNG, { output: join(dir, 'edge-pq.png'), preset: 'pq' });
    const jpgOut = await assign(JPEG, { output: join(dir, 'edge-pq.jpg'), fromImage: DONOR });
    await assign(DONOR, { output: join(dir, 'donor-gamut.jpg'), preset: 'gamut' });
    const profileOut = join(dir, 'profile.icc');
    const softenedOut = join(dir, 'softened.png');

    await extract(DONOR, profileOut);
    await inspect(PNG);
    await inspect(DONOR);
    await edges(PNG);
    await edges(PNG, 'pq');
    await soften(PNG, { output: softenedOut, preset: 'pq', amount: '0.35' });

    const pngBefore = await readFile(PNG);
    const pngAfter = await readFile(pngOut);
    assert.equal(sha(pngPixelPayload(parsePng(pngBefore))), sha(pngPixelPayload(parsePng(pngAfter))));
    assert.ok(extractIccFromPng(parsePng(pngAfter))?.equals(await readFile(PQ)));

    const jpgBefore = parseJpeg(await readFile(JPEG));
    const jpgAfter = parseJpeg(await readFile(jpgOut));
    assert.equal(sha(jpgBefore.scan), sha(jpgAfter.scan));
    assert.ok(extractIccProfile(jpgAfter)?.equals(await readFile(PQ)));
    assert.ok((await readFile(profileOut)).equals(await readFile(PQ)));
    assert.notEqual(sha(pngPixelPayload(parsePng(await readFile(softenedOut)))), sha(pngPixelPayload(parsePng(pngBefore))));
    assert.ok(logs.mock.calls.length > 0);
  });

  it('covers command error branches and default outputs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hdr-lab-'));
    const input = join(dir, 'flat.png');
    const noExtension = join(dir, 'flat');
    const grayEdge = join(dir, 'gray-edge.png');
    await flatPng(input);
    await flatPng(noExtension);
    await writeFile(grayEdge, minimalPng(3, 3, 2, 3, Buffer.from([
      0, 0, 0, 0, 128, 128, 128, 255, 255, 255,
      0, 0, 0, 0, 128, 128, 128, 255, 255, 255,
      0, 0, 0, 0, 128, 128, 128, 255, 255, 255,
    ])));

    const assigned = await assign(input, {});
    const explicit = await assign(input, { profilePath: GAMUT });
    const fallbackExt = await assign(noExtension, {});
    const softened = await soften(input, {});
    const softenedFallbackExt = await soften(noExtension, {});
    assert.match(assigned, /flat-pq\.png$/);
    assert.match(explicit, /flat-tagged\.png$/);
    assert.match(fallbackExt, /flat-pq\.jpg$/);
    assert.match(softened, /flat-softened\.png$/);
    assert.match(softenedFallbackExt, /flat-softened\.png$/);
    await edges(input, 'gamut');
    await edges(grayEdge, 'gamut');

    const { png: PNG, jpeg: JPEG, donor: DONOR } = await writeSyntheticCliFixtures();
    await assert.rejects(edges(JPEG), /PNG only/);
    await assert.rejects(edges(PNG, 'bogus'), /No transfer curve/);
    await assert.rejects(soften(JPEG, {}), /PNG only/);
    await assert.rejects(soften(PNG, { preset: 'bogus' }), /No transfer curve/);
    await assert.rejects(soften(PNG, { amount: 'bad' }), /amount/);
    await assert.rejects(soften(PNG, { amount: '2' }), /amount/);
  });
});

describe('png exactness and malformed inputs', () => {
  it('covers chunk placement, dimensions, and malformed files', async () => {
    const original = syntheticRgbaPng();
    const chunks = parsePng(original);
    assert.equal(colorChunkInsertionPoint([{ type: 'IHDR', data: Buffer.alloc(13) }, { type: 'IEND', data: Buffer.alloc(0) }]), 1);
    assert.deepEqual(pngDimensions(chunks), { width: WIDTH, height: HEIGHT });
    assert.throws(() => pngDimensions([]), /missing IHDR/);

    const badLength = Buffer.concat([original.subarray(0, 8), Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x48, 0x44, 0x52])]);
    assert.throws(() => parsePng(badLength), /overruns/);
    assert.throws(() => parsePng(original.subarray(0, original.length - 12)), /no IEND/);
  });

  it('decodes every PNG filter and rejects unsupported raster shapes', () => {
    const rows = Buffer.from([
      0, 10, 20, 30,
      1, 5, 5, 5,
      2, 1, 1, 1,
      3, 1, 1, 1,
      4, 1, 1, 1,
    ]);
    const image = decodePng(parsePng(minimalPng(1, 5, 2, 3, rows)));
    assert.deepEqual(pixelAt(image, 0, 0), [10, 20, 30]);
    assert.equal(image.pixels.length, 15);

    const paethC = Buffer.from([
      0, 10, 0, 0, 20, 0, 0,
      4, 246, 0, 0, 0, 0, 0,
    ]);
    assert.equal(decodePng(parsePng(minimalPng(2, 2, 2, 3, paethC))).width, 2);

    assert.throws(() => decodePng([]), /missing IHDR/);
    assert.throws(() => decodePng(parsePng(minimalPng(1, 1, 2, 3, Buffer.alloc(4), (ihdr) => ihdr.writeUInt8(16, 8)))), /bit depth/);
    assert.throws(() => decodePng(parsePng(minimalPng(1, 1, 2, 3, Buffer.alloc(4), (ihdr) => ihdr.writeUInt8(1, 12)))), /interlaced/);
    assert.throws(() => decodePng(parsePng(minimalPng(2, 2, 2, 3, Buffer.from([0, 1])))), /truncated/);
  });

  it('filters rows, replaces pixels, and handles malformed iCCP chunks', async () => {
    const row = Buffer.from([10, 20, 30, 40]);
    const prev = Buffer.from([1, 2, 3, 4]);
    for (const type of [0, 1, 2, 3, 4]) {
      const out = Buffer.alloc(row.length);
      filterRow(type, row, prev, 2, out);
      assert.equal(out.length, row.length);
    }
    assert.equal(bestFilteredRow(row, prev, 2).length, row.length + 1);
    assert.throws(() => replacePixels([{ type: 'IHDR', data: Buffer.alloc(13) }], { width: 1, height: 1, channels: 3, pixels: Buffer.alloc(3) }), /no IDAT/);
    const twoIdat = [
      { type: 'IHDR', data: Buffer.alloc(13) },
      { type: 'IDAT', data: Buffer.from([1]) },
      { type: 'IDAT', data: Buffer.from([2]) },
      { type: 'IEND', data: Buffer.alloc(0) },
    ];
    assert.equal(replacePixels(twoIdat, { width: 1, height: 1, channels: 3, pixels: Buffer.alloc(3) }).filter((chunk) => chunk.type === 'IDAT').length, 1);

    assert.equal(extractIccFromPng([]), null);
    assert.throws(() => extractIccFromPng([{ type: 'iCCP', data: Buffer.from('bad') }]), /name terminator/);
    assert.throws(() => extractIccFromPng([{ type: 'iCCP', data: Buffer.from([65, 0, 1]) }]), /compression method/);
    const named = setIccInPng(parsePng(syntheticRgbaPng()), await readFile(PQ), 'ø'.repeat(100));
    assert.ok(extractIccFromPng(named)?.equals(await readFile(PQ)));
    assert.ok(pngCodec.facts(minimalPng(1, 1, 7, 3, Buffer.alloc(4))).notes.some((note) => note.includes('type 7')));
  });
});

describe('jpeg exactness and malformed inputs', () => {
  it('preserves scans byte-for-byte across profile assignment and detects malformed structures', async () => {
    const source = parseJpeg(syntheticJpeg());
    const profile = await readFile(PQ);
    const assigned = setIccProfile(source, profile);
    assert.equal(sha(assigned.scan), sha(source.scan));

    assert.throws(() => parseJpeg(Buffer.from([0xff, SOI, 0x00, 0x00])), /expected marker/);
    assert.throws(() => parseJpeg(Buffer.from([0xff, SOI, 0xff, 0xff])), /truncated marker/);
    assert.throws(() => parseJpeg(Buffer.from([0xff, SOI, 0xff, APP0, 0x00])), /truncated segment length/);
    assert.throws(() => parseJpeg(Buffer.from([0xff, SOI, 0xff, APP0, 0x00, 0x01])), /bad segment length/);
    assert.throws(() => parseJpeg(Buffer.from([0xff, SOI, 0xff, APP0, 0x00, 0x04, 0x00])), /overruns/);
    assert.throws(() => parseJpeg(Buffer.from([0xff, SOI, 0xff, APP0, 0x00, 0x02])), /no SOS or EOI/);
    assert.throws(() => serializeJpeg({ segments: [{ marker: APP0, payload: Buffer.alloc(MAX_SEGMENT_PAYLOAD + 1) }], scan: Buffer.alloc(0) }), /too large/);
  });

  it('covers markers, frame facts, quality buckets, and ICC segment ordering', async () => {
    assert.equal(isStandalone(TEM), true);
    assert.equal(isStandalone(RST_FIRST), true);
    assert.equal(isStandalone(SOI), true);
    assert.equal(isStandalone(APP0), false);
    assert.equal(isTerminal(EOI), true);
    assert.equal(isTerminal(APP1), false);
    assert.equal(markerName(0xab), '0xAB');

    assert.equal(readFrameInfo({ segments: [], scan: Buffer.alloc(0) }), null);
    assert.equal(readFrameInfo({ segments: [{ marker: 0xc4, payload: Buffer.alloc(8) }], scan: Buffer.alloc(0) }), null);
    assert.equal(readFrameInfo({ segments: [{ marker: 0xc0, payload: framePayload(2, 3, 0x21) }], scan: Buffer.alloc(0) })?.sampling, '4:2:2');
    assert.equal(readFrameInfo({ segments: [{ marker: 0xc0, payload: framePayload(2, 3, 0x22) }], scan: Buffer.alloc(0) })?.sampling, '4:2:0');
    assert.equal(readFrameInfo({ segments: [{ marker: 0xc0, payload: framePayload(2, 3, 0x33) }], scan: Buffer.alloc(0) })?.sampling, '3x3');
    assert.equal(readFrameInfo({ segments: [{ marker: 0xc0, payload: framePayload(2, 3, 0x11, 1) }], scan: Buffer.alloc(0) })?.sampling, 'grayscale');
    assert.equal(readFrameInfo({ segments: [{ marker: 0xc0, payload: Buffer.alloc(6) }], scan: Buffer.alloc(0) })?.sampling, 'unknown');
    assert.equal(lumaQuantizationAverage({ segments: [], scan: Buffer.alloc(0) }), null);

    const standalone = Buffer.from([0xff, SOI, 0xff, TEM, 0xff, EOI]);
    assert.equal(sha(serializeJpeg(parseJpeg(standalone))), sha(standalone));
    const high = jpegWithSegments([{ marker: 0xdb, payload: dqtPayload(5) }, { marker: 0xc0, payload: framePayload(1, 1, 0x11) }]);
    const low = jpegWithSegments([{ marker: 0xdb, payload: dqtPayload(20, 1) }, { marker: 0xc0, payload: framePayload(1, 1, 0x11) }]);
    const bare = jpegWithSegments([]);
    assert.equal(jpegCodec.facts(bare).width, 0);
    assert.equal(jpegCodec.facts(bare).notes.length, 0);
    assert.ok(jpegCodec.facts(high).notes.some((note) => note.includes('high quality')));
    assert.ok(jpegCodec.facts(low).notes.some((note) => note.includes('detail already discarded')));
    assert.equal(jpegCodec.getProfile(bare), null);
    assert.throws(() => setIccProfile(parseJpeg(high), Buffer.alloc(255 * 65519 + 1)), /too large/);
  });
});

describe('icc and profile edge cases', () => {
  it('reads descriptions, tags, primaries, and bad profile branches', async () => {
    const pq = await readFile(PQ);
    const gamut = await readFile(GAMUT);
    assert.equal(ascii(Buffer.from(' RGB '), 0, 5), 'RGB');
    assert.equal(findIccTag(Buffer.alloc(100), 'desc'), null);
    assert.equal(findIccTag(Buffer.concat([Buffer.alloc(128), Buffer.from([0, 0, 0, 1])]), 'desc'), null);
    const outOfBounds = Buffer.concat([Buffer.alloc(128), Buffer.from([0, 0, 0, 1]), Buffer.from('desc'), Buffer.from([0, 0, 3, 232, 0, 0, 0, 4])]);
    assert.equal(findIccTag(outOfBounds, 'desc'), null);

    assert.throws(() => summarizeIcc(Buffer.alloc(10)), /truncated/);
    assert.throws(() => summarizeIcc(Buffer.alloc(128)), /acsp/);
    const noDesc = Buffer.alloc(132);
    noDesc.writeUInt32BE(noDesc.length, 0);
    noDesc.writeUInt8(4, 8);
    noDesc.write('mntr', 12, 'latin1');
    noDesc.write('RGB ', 16, 'latin1');
    noDesc.write('XYZ ', 20, 'latin1');
    noDesc.write('acsp', 36, 'latin1');
    assert.equal(summarizeIcc(noDesc).description, '(no description tag)');
    assert.equal(summarizeIcc(profileWithDesc('mluc', Buffer.concat([Buffer.from('mluc'), Buffer.alloc(8)]))).description, '');
    assert.equal(summarizeIcc(profileWithDesc('zzzz', Buffer.alloc(12))).description, '(unsupported desc type zzzz)');
    assert.equal(summarizeIcc(profileWithDesc('desc', Buffer.concat([Buffer.from('desc'), Buffer.alloc(4), Buffer.from([0, 0, 0, 5]), Buffer.from('Name\0')]))).description, 'Name');

    assert.equal(readIccXyzTag(Buffer.alloc(128), 'rXYZ'), null);
    const wrongType = profileWithDesc('desc', Buffer.concat([Buffer.from('abcd'), Buffer.alloc(16)]));
    assert.equal(readIccXyzTag(wrongType, 'desc'), null);
    assert.equal(sameGamut(pq, gamut), true);
    assert.equal(sameGamut(Buffer.alloc(128), gamut), false);
    assert.equal(sameGamut(Buffer.from(pq.map((byte, index) => (index === 200 ? byte ^ 0xff : byte))), gamut, 0), false);
  });

  it('resolves every profile source and rejects missing embedded profiles', async () => {
    assert.equal((await resolveProfile({ profilePath: GAMUT })).origin, GAMUT);
    const { png: PNG, donor: DONOR } = await writeSyntheticCliFixtures();
    assert.match((await resolveProfile({ fromImage: DONOR })).origin, /embedded/);
    await assert.rejects(readProfileFromImage(PNG), /No embedded ICC/);
    await assert.rejects(resolveProfile({ preset: 'missing' }), /Unknown preset/);
    PRESETS.push({ name: 'missing-file', file: 'missing.icc', suffix: '-missing', summary: 'missing' });
    try {
      await assert.rejects(resolveProfile({ preset: 'missing-file' }), /Bundled profile missing/);
    } finally {
      PRESETS.pop();
    }
  });
});

describe('color branch coverage', () => {
  it('covers low-end transfer, Lab, edge, gamut, and softening branches', () => {
    assert.ok(Math.abs(linearToSrgb(0.001) - 0.01292) < 1e-12);
    assert.ok(Math.abs(linearToBt2020(0.01) - 0.045) < 1e-12);
    assert.ok(nitsToPq(-10) < 1e-6);
    assert.equal(nitsToPq(20_000), 1);
    assert.deepEqual(applyMatrix(SRGB_TO_XYZ, [0, 0, 0]), [0, 0, 0]);
    assert.ok(deltaE76(xyzToLab([0, 0, 0]), xyzToLab([0.5, 0.5, 0.5])) > 0);
    assert.equal(deltaChroma([1, 2, 3], [4, 2, 3]), 0);
    assert.equal(suggestedAmount(-1), 0);
    assert.equal(suggestedAmount(2), 0.6);

    const black = [0, 0, 0, 255];
    const gray = [127, 127, 127, 255];
    const white = [255, 255, 255, 255];
    const clear = [0, 0, 0, 0];
    const row = (cells: number[][]) => Buffer.from(cells.flat());
    const pixels = Buffer.concat([
      row([black, gray, white, black, black, white]),
      row([black, clear, gray, black, black, white]),
      row([black, gray, white, black, black, white]),
      row([black, gray, white, black, black, white]),
    ]);
    const image: RasterImage = { width: 6, height: 4, channels: 4, pixels };
    assert.equal(opaque(image, 1, 1), false);
    assert.deepEqual(codesAt(image, 0, 0), [0, 0, 0]);
    assert.ok(scanEdges(image).length >= 1);
    assert.ok(measureEdges(image, CURVES.srgb!, CURVES.pq!).antiAliased >= 1);
    assert.ok(measureGamutDistance(image, CURVES.gamut!).edges >= 1);
    assert.throws(() => softenEdges(image, CURVES.pq!, INVERSE_CURVES.pq!, Number.NaN), /amount/);
  });
});
