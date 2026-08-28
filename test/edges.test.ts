import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { measureEdges } from "../src/color/edge-report.js";
import { measureGamutDistance, suggestedAmount } from "../src/color/gamut-distance.js";
import { softenEdges } from "../src/color/soften.js";
import { CURVES, INVERSE_CURVES } from "../src/color/transfer.js";
import { decodePng, pixelAt } from "../src/png/decode.js";
import { parsePng } from "../src/png/chunks.js";
import {
  BACKGROUND,
  BACKGROUND_X,
  BLEND,
  BLEND_X,
  HEIGHT,
  LETTER,
  WIDTH,
  syntheticRgbaPng,
} from "./synthetic-cli-fixtures.js";

function loadEdge() {
  return decodePng(parsePng(syntheticRgbaPng()));
}

describe("png decode", () => {
  it("decodes the edge fixture to a full RGBA raster", () => {
    const image = loadEdge();
    assert.equal(image.width, WIDTH);
    assert.equal(image.height, HEIGHT);
    assert.equal(image.channels, 4);
    assert.equal(image.pixels.length, WIDTH * HEIGHT * 4);
  });

  it("reads the known white-on-blue transect", () => {
    const image = loadEdge();
    assert.deepEqual(pixelAt(image, 0, 0), [...LETTER]);
    assert.deepEqual(pixelAt(image, BLEND_X, 0), [...BLEND]);
    assert.deepEqual(pixelAt(image, BACKGROUND_X, 0), [...BACKGROUND]);
  });

  it("refuses colour types it cannot decode", () => {
    const chunks = parsePng(syntheticRgbaPng());
    const ihdr = chunks.find((chunk) => chunk.type === "IHDR")!;
    ihdr.data.writeUInt8(3, 9);
    assert.throws(() => decodePng(chunks), /Unsupported PNG colour type/);
  });
});

describe("edge report", () => {
  it("finds anti-aliased pixels in the edge fixture", () => {
    const report = measureEdges(loadEdge(), CURVES.srgb!, CURVES.srgb!);
    assert.ok(report.antiAliased >= HEIGHT - 2, `only ${report.antiAliased} blended pixels`);
  });

  it("is a no-op when the assigned curve is the authoring curve", () => {
    const report = measureEdges(loadEdge(), CURVES.srgb!, CURVES.srgb!);
    assert.ok(Math.abs(report.authored - report.assigned) < 1e-9);
  });

  it("shows PQ collapsing anti-aliasing toward the dark side", () => {
    const pq = measureEdges(loadEdge(), CURVES.srgb!, CURVES.pq!);
    assert.ok(
      pq.authored / pq.assigned > 1.5,
      `PQ only moved edges ${(pq.authored / pq.assigned).toFixed(2)}x`,
    );
    assert.ok(pq.collapsed > 0.5, `only ${(pq.collapsed * 100).toFixed(1)}% of blends collapsed`);
  });

  it("shows the gamut preset keeping anti-aliasing intact", () => {
    const gamut = measureEdges(loadEdge(), CURVES.srgb!, CURVES.gamut!);
    assert.ok(
      gamut.authored / gamut.assigned < 1.5,
      `BT.2020 moved edges ${(gamut.authored / gamut.assigned).toFixed(2)}x`,
    );
    assert.ok(
      gamut.collapsed < 0.1,
      `BT.2020 collapsed ${(gamut.collapsed * 100).toFixed(1)}% of blends`,
    );
  });

  it("shows Rec.2020 primaries stretching chroma distance", () => {
    const report = measureGamutDistance(loadEdge(), CURVES.gamut!);
    assert.ok(report.edges >= HEIGHT - 2, `only ${report.edges} gamut samples`);
    assert.ok(report.chromaStretch > 1.05, `chroma stretch was only ${report.chromaStretch}`);
    assert.ok(suggestedAmount(report.chromaStretch) > 0);
  });

  it("softens detected blend pixels without changing dimensions or alpha", () => {
    const image = loadEdge();
    const report = softenEdges(image, CURVES.pq!, INVERSE_CURVES.pq!, 0.35);

    assert.equal(report.image.width, image.width);
    assert.equal(report.image.height, image.height);
    assert.equal(report.image.channels, image.channels);
    assert.equal(pixelAt(report.image, BLEND_X, 1)[3], 255);
    assert.notDeepEqual(pixelAt(report.image, BLEND_X, 1), pixelAt(image, BLEND_X, 1));
  });

  it("reports nothing for a flat image with no edges", () => {
    const flat = { width: 8, height: 8, channels: 3, pixels: Buffer.alloc(8 * 8 * 3, 128) };
    const report = measureEdges(flat, CURVES.srgb!, CURVES.pq!);
    assert.equal(report.antiAliased, 0);
  });

  it("ignores hard edges with no blended pixel between them", () => {
    const width = 8;
    const height = 8;
    const pixels = Buffer.alloc(width * height * 3, 0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 4; x < width; x += 1) pixels.fill(255, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
    const report = measureEdges({ width, height, channels: 3, pixels }, CURVES.srgb!, CURVES.pq!);
    assert.equal(report.antiAliased, 0);
  });
});
