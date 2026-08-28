import { describe, it, expect } from "vitest";
import { enqueueFiles, dequeueFiles } from "@/lib/file-queue";

const fakeFile = (name: string) => new File([""], name, { type: "image/png" });

describe("file-queue", () => {
  it("dequeue of empty queue returns empty array", () => {
    dequeueFiles();
    expect(dequeueFiles()).toEqual([]);
  });

  it("enqueued files are returned by dequeue", () => {
    const files = [fakeFile("a.png"), fakeFile("b.png")];
    enqueueFiles(files);
    const out = dequeueFiles();
    expect(out).toEqual(files);
  });

  it("dequeue empties the queue", () => {
    enqueueFiles([fakeFile("x.png")]);
    dequeueFiles();
    expect(dequeueFiles()).toEqual([]);
  });

  it("second enqueue replaces first", () => {
    const first = [fakeFile("first.png")];
    const second = [fakeFile("second.png")];
    enqueueFiles(first);
    enqueueFiles(second);
    expect(dequeueFiles()).toEqual(second);
  });
});
