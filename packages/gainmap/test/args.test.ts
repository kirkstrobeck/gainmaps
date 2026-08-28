import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { flagBool, flagNumber, flagString, flagStrings, parseArgs } from "#src/args.js";

describe("args", () => {
  it("parses aliases, equals, booleans, rest, and repeatable flags", () => {
    const parsed = parseArgs([
      "convert", "in.png", "-o", "out.jpg", "--verbose", "--exclude", "a/**", "--exclude=b/**",
      "--help", "-R", "--", "-weird",
    ]);
    assert.deepEqual(parsed.positionals, ["convert", "in.png", "-weird"]);
    assert.equal(flagString(parsed.flags, "output"), "out.jpg");
    assert.equal(flagBool(parsed.flags, "help"), true);
    assert.equal(flagBool(parsed.flags, "recursive"), true);
    assert.deepEqual(flagStrings(parsed.flags, "exclude"), ["a/**", "b/**"]);
    assert.equal(flagString(parsed.flags, "exclude"), "b/**");
    assert.equal(flagString({}, "missing"), undefined);
    assert.deepEqual(flagStrings({}, "exclude"), []);
    assert.equal(flagNumber({ jobs: "4" }, "jobs"), 4);
    assert.equal(flagNumber({}, "jobs"), undefined);
  });

  it("treats dash as a positional and rejects missing values", () => {
    const parsed = parseArgs(["-", "--stdout"]);
    assert.deepEqual(parsed.positionals, ["-"]);
    assert.equal(flagBool(parsed.flags, "stdout"), true);
    assert.throws(() => parseArgs(["--quality"]), /requires a value/);
    assert.equal(flagString(parseArgs(["--suffix", "-hdr"]).flags, "suffix"), "-hdr");
    assert.throws(() => flagString({ quality: true }, "quality"), /requires a value/);
    assert.throws(() => flagNumber({ jobs: "nope" }, "jobs"), /must be a number/);
    assert.equal(flagBool(parseArgs(["-i", "a.jpg"]).flags, "in-place"), true);
    assert.equal(flagBool(parseArgs(["--in-place", "a.jpg"]).flags, "in-place"), true);
  });

  it("stores a single repeatable value as an array after the second flag", () => {
    const once = parseArgs(["--exclude", "raw/**"]);
    assert.deepEqual(flagStrings(once.flags, "exclude"), ["raw/**"]);
    const twice = parseArgs(["--exclude", "raw/**", "--exclude", "tmp/**"]);
    assert.deepEqual(flagStrings(twice.flags, "exclude"), ["raw/**", "tmp/**"]);
  });

  it("aliases --out to --output", () => {
    const parsed = parseArgs(["in.png", "--out", "dest.webp"]);
    assert.equal(flagString(parsed.flags, "output"), "dest.webp");
    const equals = parseArgs(["in.png", "--out=dest.png"]);
    assert.equal(flagString(equals.flags, "output"), "dest.png");
    const typed = parseArgs(["in.png", "--out", "./out", "--out-type", "webp"]);
    assert.equal(flagString(typed.flags, "output"), "./out");
    assert.equal(flagString(typed.flags, "out-type"), "webp");
  });

  it("rejects unknown flags", () => {
    assert.throws(() => parseArgs(["--nope"]), /unsupported option/);
    assert.throws(() => parseArgs(["--nope=1"]), /unsupported option/);
    assert.throws(() => parseArgs(["-z"]), /unsupported option/);
  });
});
