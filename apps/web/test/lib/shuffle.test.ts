import { describe, it, expect } from "vitest";
import { shuffle } from "@/lib/shuffle";

describe("shuffle", () => {
  it("returns an array of the same length", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(arr.length);
  });

  it("contains the same elements as the input", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it("does not mutate the original array", () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffle(arr);
    expect(arr).toEqual(copy);
  });

  it("handles empty arrays", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("handles single-element arrays", () => {
    expect(shuffle([42])).toEqual([42]);
  });
});
