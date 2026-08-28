import { describe, it, expect } from "vitest";
import { outputName } from "@/lib/output-name";

describe("outputName", () => {
  it(".jpg — preserves extension, no conversion", () => {
    const r = outputName("photo.jpg");
    expect(r.name).toBe("photo-gainmap.jpg");
    expect(r.ext).toBe(".jpg");
    expect(r.converted).toBe(false);
    expect(r.fromLabel).toBeNull();
  });

  it(".jpeg — preserves extension, no conversion", () => {
    const r = outputName("photo.jpeg");
    expect(r.name).toBe("photo-gainmap.jpeg");
    expect(r.ext).toBe(".jpeg");
    expect(r.converted).toBe(false);
    expect(r.fromLabel).toBeNull();
  });

  it(".JPG — preserves case, no conversion", () => {
    const r = outputName("photo.JPG");
    expect(r.name).toBe("photo-gainmap.JPG");
    expect(r.ext).toBe(".JPG");
    expect(r.converted).toBe(false);
  });

  it(".JPEG — preserves case, no conversion", () => {
    const r = outputName("photo.JPEG");
    expect(r.name).toBe("photo-gainmap.JPEG");
    expect(r.ext).toBe(".JPEG");
    expect(r.converted).toBe(false);
  });

  it(".png — converts to .jpg, converted=true, fromLabel=PNG", () => {
    const r = outputName("photo.png");
    expect(r.name).toBe("photo-gainmap.jpg");
    expect(r.ext).toBe(".jpg");
    expect(r.converted).toBe(true);
    expect(r.fromLabel).toBe("PNG");
  });

  it(".heic — converts to .jpg, converted=true, fromLabel=HEIC", () => {
    const r = outputName("photo.heic");
    expect(r.name).toBe("photo-gainmap.jpg");
    expect(r.ext).toBe(".jpg");
    expect(r.converted).toBe(true);
    expect(r.fromLabel).toBe("HEIC");
  });

  it("no extension — converts to .jpg, converted=true, fromLabel=UNKNOWN", () => {
    const r = outputName("photo");
    expect(r.name).toBe("photo-gainmap.jpg");
    expect(r.ext).toBe(".jpg");
    expect(r.converted).toBe(true);
    expect(r.fromLabel).toBe("UNKNOWN");
  });
});
