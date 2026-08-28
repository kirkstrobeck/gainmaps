import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { parsePng, serializePng } from "../src/png/chunks.js";
import { crc32 } from "../src/png/crc32.js";
import { decodePng } from "../src/png/decode.js";
import { replacePixels } from "../src/png/encode.js";
import { codecFor } from "../src/image/registry.js";
import { pngCodec } from "../src/image/png-codec.js";
import { summarizeIcc } from "../src/icc/describe.js";
import {
  BLEND_X,
  HEIGHT,
  WIDTH,
  syntheticJpeg,
  syntheticRgbaPng,
} from "./synthetic-cli-fixtures.js";

const PROFILE = "profiles/rec2020-pq.icc";
const EXPECTED = "Rec2020 Gamut with PQ Transfer";

const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

describe("png chunks", () => {
  it("matches the known CRC-32 of \"123456789\"", () => {
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  });

  it("re-serializes an untouched PNG byte-for-byte", () => {
    const original = syntheticRgbaPng();
    assert.equal(sha(serializePng(parsePng(original))), sha(original));
  });

  it("rejects a bad signature", () => {
    assert.throws(() => parsePng(Buffer.alloc(16)), /bad signature/);
  });

  it("can replace IDAT after decoding without dropping other chunks", () => {
    const original = syntheticRgbaPng();
    const chunks = parsePng(original);
    const image = decodePng(chunks);
    const at = BLEND_X * image.channels;
    image.pixels[at] = 80;

    const rewritten = parsePng(serializePng(replacePixels(chunks, image)));
    assert.deepEqual(
      rewritten.map((chunk) => chunk.type),
      chunks.map((chunk) => chunk.type),
    );
    assert.deepEqual(decodePng(rewritten).pixels.subarray(at, at + 4), Buffer.from([80, 93, 166, 255]));
  });
});

describe("png profile assignment", () => {
  it("embeds iCCP without touching IDAT", async () => {
    const original = syntheticRgbaPng();
    const profile = await readFile(PROFILE);

    const tagged = pngCodec.setProfile(original, profile, EXPECTED);

    assert.equal(sha(pngCodec.pixelPayload(tagged)), sha(pngCodec.pixelPayload(original)));
    assert.ok(pngCodec.getProfile(tagged)?.equals(profile));
    assert.equal(summarizeIcc(pngCodec.getProfile(tagged)!).description, EXPECTED);
  });

  it("drops sRGB and gAMA, which conflict with iCCP", async () => {
    const original = syntheticRgbaPng();
    const before = parsePng(original).map((c) => c.type);
    assert.ok(before.includes("sRGB"), "fixture should have an sRGB chunk to drop");

    const after = parsePng(pngCodec.setProfile(original, await readFile(PROFILE), EXPECTED));
    const types = after.map((c) => c.type);

    assert.ok(!types.includes("sRGB"));
    assert.ok(!types.includes("gAMA"));
    assert.equal(types.filter((t) => t === "iCCP").length, 1);
    assert.ok(types.indexOf("iCCP") < types.indexOf("IDAT"), "iCCP must precede IDAT");
  });

  it("replaces rather than stacks on repeated assignment", async () => {
    const profile = await readFile(PROFILE);
    const once = pngCodec.setProfile(syntheticRgbaPng(), profile, EXPECTED);
    const twice = pngCodec.setProfile(once, profile, EXPECTED);

    assert.equal(parsePng(twice).filter((c) => c.type === "iCCP").length, 1);
    assert.equal(sha(twice), sha(once), "assignment should be idempotent");
  });

  it("preserves the alpha channel and dimensions", async () => {
    const tagged = pngCodec.setProfile(syntheticRgbaPng(), await readFile(PROFILE), EXPECTED);
    const facts = pngCodec.facts(tagged);

    assert.equal(facts.width, WIDTH);
    assert.equal(facts.height, HEIGHT);
    assert.ok(facts.notes.some((n) => n.includes("truecolour+alpha")));
  });
});

describe("codec registry", () => {
  it("routes each format to its codec", () => {
    assert.equal(codecFor(syntheticRgbaPng()).name, "PNG");
    assert.equal(codecFor(syntheticJpeg()).name, "JPEG");
  });

  it("rejects unknown formats", () => {
    assert.throws(() => codecFor(Buffer.from("GIF89a....")), /Unsupported format/);
  });

  it("reports the jpeg fixture as near-lossless 4:4:4", () => {
    const jpeg = syntheticJpeg();
    const facts = codecFor(jpeg).facts(jpeg);
    assert.equal(facts.width, WIDTH);
    assert.ok(facts.notes.some((n) => n.includes("4:4:4")), facts.notes.join("; "));
    assert.ok(facts.notes.some((n) => n.includes("near-lossless")), facts.notes.join("; "));
  });
});
