import { describe, expect, it } from "vitest";

import { appendVary } from "@/lib/append-vary";

describe("appendVary", () => {
  it("sets the token when Vary is missing", () => {
    const headers = new Headers();
    appendVary(headers, "Accept");
    expect(headers.get("vary")).toBe("Accept");
  });

  it("appends to an existing Vary list", () => {
    const headers = new Headers({ vary: "Accept-Encoding" });
    appendVary(headers, "Accept");
    expect(headers.get("vary")).toBe("Accept-Encoding, Accept");
  });

  it("does not duplicate a token already present", () => {
    const headers = new Headers({ vary: "Accept, Accept-Encoding" });
    appendVary(headers, "Accept");
    expect(headers.get("vary")).toBe("Accept, Accept-Encoding");
  });

  it("treats an existing token as present regardless of case", () => {
    const headers = new Headers({ vary: "accept" });
    appendVary(headers, "Accept");
    expect(headers.get("vary")).toBe("accept");
  });
});
