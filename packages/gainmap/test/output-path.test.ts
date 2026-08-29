import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  DEFAULT_SUFFIX,
  defaultOutputPath,
  isJpegOutputPath,
  normalizeOutType,
  planInPlace,
  planOutputs,
  stripExtension,
  typesAgree,
} from "#src/output-path.js";

describe("output-path", () => {
  it("builds default names and plans stdout, file, and directory outputs", () => {
    assert.equal(DEFAULT_SUFFIX, "-gain");
    assert.equal(stripExtension("a.png"), "a");
    assert.equal(stripExtension("a"), "a");
    assert.match(defaultOutputPath("/tmp/photo.jpg"), /photo-gain\.jpg$/);
    const def = planOutputs(["/tmp/a.jpg"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(def[0]!.output ?? "", /a-gain\.jpg$/);
    const stdout = planOutputs(["/tmp/a.png"], { suffix: "-gain", stdout: true, outputIsDirectory: false });
    assert.equal(stdout[0]!.stdout, true);
    const dash = planOutputs(["/tmp/a.png"], { output: "-", suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.equal(dash[0]!.stdout, true);
    const file = planOutputs(["/tmp/a.png"], { output: "/tmp/out.jpg", suffix: "", stdout: false, outputIsDirectory: false });
    assert.equal(file[0]!.output, "/tmp/out.jpg");
    const dir = planOutputs(["/tmp/shots/a.jpg"], { output: "/tmp/out", suffix: "-hdr", stdout: false, outputIsDirectory: true, root: "/tmp/shots" });
    assert.equal(dir[0]!.output, "/tmp/out/a-hdr.jpg");
    const nested = planOutputs(["/tmp/shots/sub/a.jpg"], { output: "/tmp/out", suffix: "", stdout: false, outputIsDirectory: true, root: "/tmp/shots" });
    assert.equal(nested[0]!.output, "/tmp/out/sub/a.jpg");
    assert.throws(() => planOutputs(["a.png", "b.png"], { suffix: "-gain", stdout: true, outputIsDirectory: false }), /exactly one/);
    assert.throws(() => planOutputs(["a.png", "b.png"], { output: "-", suffix: "-gain", stdout: false, outputIsDirectory: false }), /exactly one/);
  });

  it("directory dest with empty suffix keeps the jpeg basename", () => {
    const dir = planOutputs(["/tmp/shots/a.jpg"], { output: "/tmp/out", suffix: "", stdout: false, outputIsDirectory: true, root: "/tmp/shots" });
    assert.equal(dir[0]!.output, "/tmp/out/a.jpg");
    const nested = planOutputs(["/tmp/shots/sub/a.jpg"], { output: "/tmp/out", suffix: "", stdout: false, outputIsDirectory: true, root: "/tmp/shots" });
    assert.equal(nested[0]!.output, "/tmp/out/sub/a.jpg");
    const flat = planOutputs(["/tmp/shots/a.jpg"], { output: "/tmp/out", suffix: "", stdout: false, outputIsDirectory: true });
    assert.equal(flat[0]!.output, "/tmp/out/a.jpg");
  });

  it("plans in-place outputs equal to inputs", () => {
    const plans = planInPlace(["/tmp/a.jpg", "/tmp/nested/b.jpg"]);
    assert.equal(plans[0]!.output, "/tmp/a.jpg");
    assert.equal(plans[1]!.output, "/tmp/nested/b.jpg");
    assert.equal(plans[0]!.stdout, false);
  });

  it("preserves .jpg extension exactly", () => {
    assert.match(defaultOutputPath("/tmp/photo.jpg"), /photo-gain\.jpg$/);
    const plan = planOutputs(["/tmp/a.jpg"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(plan[0]!.output ?? "", /a-gain\.jpg$/);
  });

  it("preserves .jpeg extension exactly", () => {
    assert.match(defaultOutputPath("/tmp/photo.jpeg"), /photo-gain\.jpeg$/);
    const plan = planOutputs(["/tmp/a.jpeg"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(plan[0]!.output ?? "", /a-gain\.jpeg$/);
  });

  it("preserves uppercase JPEG extension (.JPG)", () => {
    assert.match(defaultOutputPath("/tmp/photo.JPG"), /photo-gain\.JPG$/);
    const dir = planOutputs(["/tmp/shots/a.JPG"], { output: "/tmp/out", suffix: "", stdout: false, outputIsDirectory: true, root: "/tmp/shots" });
    assert.equal(dir[0]!.output, "/tmp/out/a.JPG");
    const withSuffix = planOutputs(["/tmp/shots/a.JPG"], { output: "/tmp/out", suffix: "-hdr", stdout: false, outputIsDirectory: true, root: "/tmp/shots" });
    assert.equal(withSuffix[0]!.output, "/tmp/out/a-hdr.JPG");
  });

  it("auto-names non-extension inputs with .jpg suffix", () => {
    assert.match(defaultOutputPath("/tmp/photo"), /photo-gain\.jpg$/);
    const plan = planOutputs(["/tmp/photo"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(plan[0]!.output ?? "", /photo-gain\.jpg$/);
    assert.throws(
      () => planOutputs(["/tmp/photo"], { output: "/tmp/out.bmp", suffix: "", stdout: false, outputIsDirectory: false }),
      /must be/,
    );
  });

  it("auto-names non-JPEG inputs (.png) with .jpg suffix", () => {
    assert.match(defaultOutputPath("/tmp/photo.png"), /photo-gain\.jpg$/);
    assert.match(defaultOutputPath("/tmp/photo.PNG"), /photo-gain\.jpg$/);
    const plan = planOutputs(["/tmp/a.PNG"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(plan[0]!.output ?? "", /a-gain\.jpg$/);
    const pngOut = planOutputs(["/tmp/a.PNG"], { output: "/tmp/out.png", suffix: "", stdout: false, outputIsDirectory: false });
    assert.equal(pngOut[0]!.output, "/tmp/out.png");
  });

  it("log path contains real extension (.jpeg)", () => {
    const path = defaultOutputPath("/tmp/photo.jpeg");
    assert.match(path, /photo-gain\.jpeg$/);
    const plan = planOutputs(["/tmp/a.jpeg"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(plan[0]!.output ?? "", /a-gain\.jpeg$/);
  });

  it("auto-names .webp and .heic inputs with .jpg suffix", () => {
    assert.match(defaultOutputPath("/tmp/photo.webp"), /photo-gain\.jpg$/);
    assert.match(defaultOutputPath("/tmp/photo.heic"), /photo-gain\.jpg$/);
    assert.match(defaultOutputPath("/tmp/clip.mp4"), /clip-gain\.mp4$/);
    const plan = planOutputs(["/tmp/a.webp"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(plan[0]!.output ?? "", /a-gain\.jpg$/);
    const webpOut = planOutputs(["/tmp/a.webp"], { output: "/tmp/out.webp", suffix: "", stdout: false, outputIsDirectory: false });
    assert.equal(webpOut[0]!.output, "/tmp/out.webp");
    const mp4Out = planOutputs(["/tmp/clip.mp4"], { output: "/tmp/out", suffix: "", stdout: false, outputIsDirectory: true, outType: "mp4" });
    assert.equal(mp4Out[0]!.output, "/tmp/out/clip.mp4");
  });

  it("preserves uppercase JPEG extension (.JPEG)", () => {
    assert.match(defaultOutputPath("/tmp/photo.JPEG"), /photo-gain\.JPEG$/);
    const plan = planOutputs(["/tmp/a.JPEG"], { suffix: "-gain", stdout: false, outputIsDirectory: false });
    assert.match(plan[0]!.output ?? "", /a-gain\.JPEG$/);
  });

  it("accepts .png with explicit .jpg output path (escape hatch)", () => {
    const plan = planOutputs(["/tmp/photo.png"], { output: "/tmp/out.jpg", suffix: "", stdout: false, outputIsDirectory: false });
    assert.equal(plan[0]!.output, "/tmp/out.jpg");
  });

  it("directory outType swaps extension literally", () => {
    const webp = planOutputs(["/tmp/shots/a.png"], {
      output: "/tmp/out",
      suffix: "",
      stdout: false,
      outputIsDirectory: true,
      root: "/tmp/shots",
      outType: "webp",
    });
    assert.equal(webp[0]!.output, "/tmp/out/a.webp");
    const jpeg = planOutputs(["/tmp/shots/a.png"], {
      output: "/tmp/out",
      suffix: "",
      stdout: false,
      outputIsDirectory: true,
      outType: "jpeg",
    });
    assert.equal(jpeg[0]!.output, "/tmp/out/a.jpeg");
    const nested = planOutputs(["/tmp/shots/nested/b.jpg"], {
      output: "/tmp/out",
      suffix: "",
      stdout: false,
      outputIsDirectory: true,
      root: "/tmp/shots",
      outType: "webp",
    });
    assert.equal(nested[0]!.output, "/tmp/out/nested/b.webp");
  });

  it("normalizes out-type and agrees jpg/jpeg and tif/tiff", () => {
    assert.equal(normalizeOutType(".WEBP"), "webp");
    assert.equal(normalizeOutType("JPEG"), "jpeg");
    assert.equal(normalizeOutType("MP4"), "mp4");
    assert.throws(() => normalizeOutType("foo"), /must be/);
    assert.throws(() => normalizeOutType(".foo"), /must be/);
    assert.equal(typesAgree("jpg", "jpeg"), true);
    assert.equal(typesAgree("tif", "tiff"), true);
    assert.equal(typesAgree("png", "webp"), false);
    const agreed = planOutputs(["/tmp/a.png"], {
      output: "/tmp/dest.jpg",
      suffix: "",
      stdout: false,
      outputIsDirectory: false,
      outType: "jpeg",
    });
    assert.equal(agreed[0]!.output, "/tmp/dest.jpg");
    const tiffAgreed = planOutputs(["/tmp/a.png"], {
      output: "/tmp/dest.tif",
      suffix: "",
      stdout: false,
      outputIsDirectory: false,
      outType: "tiff",
    });
    assert.equal(tiffAgreed[0]!.output, "/tmp/dest.tif");
    assert.throws(
      () =>
        planOutputs(["/tmp/a.png"], {
          output: "/tmp/file.png",
          suffix: "",
          stdout: false,
          outputIsDirectory: false,
          outType: "jpeg",
        }),
      /must be/,
    );
  });

  it("rejects unknown file extensions without a known out type", () => {
    assert.throws(
      () =>
        planOutputs(["/tmp/a.png"], {
          output: "/tmp/out",
          suffix: "",
          stdout: false,
          outputIsDirectory: false,
        }),
      /must be/,
    );
    assert.equal(isJpegOutputPath("/tmp/out.bmp"), false);
    assert.equal(isJpegOutputPath("/tmp/out"), false);
    assert.equal(isJpegOutputPath("/tmp/out.jpg"), true);
  });
});
