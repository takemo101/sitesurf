import { describe, expect, it } from "vitest";
import { normalizeImageForApi } from "../agent-loop";

describe("normalizeImageForApi", () => {
  it("splits standard data URL into mimeType and base64", () => {
    const result = normalizeImageForApi("data:image/png;base64,QUJDRA==");
    expect(result).toEqual({ mimeType: "image/png", base64: "QUJDRA==" });
  });

  it("handles data URL with extra metadata", () => {
    const result = normalizeImageForApi("data:image/jpeg;name=test.jpg;base64,AAAA");
    expect(result).toEqual({ mimeType: "image/jpeg", base64: "AAAA" });
  });

  it("keeps raw base64 unchanged with png fallback", () => {
    const result = normalizeImageForApi("iVBORw0KGgoAAAANSUhEUgAA");
    expect(result).toEqual({
      mimeType: "image/png",
      base64: "iVBORw0KGgoAAAANSUhEUgAA",
    });
  });

  it("falls back for malformed data URL", () => {
    const result = normalizeImageForApi("data:image/png,not-base64");
    expect(result).toEqual({
      mimeType: "image/png",
      base64: "data:image/png,not-base64",
    });
  });
});
