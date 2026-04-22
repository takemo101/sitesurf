import { describe, expect, it } from "vitest";
import {
  isFenceMarkerLine,
  iterateAllMarkdownLines,
  iterateMarkdownBody,
} from "../markdown-section";

describe("isFenceMarkerLine", () => {
  it("matches plain ``` and language-tagged fences", () => {
    expect(isFenceMarkerLine("```")).toBe(true);
    expect(isFenceMarkerLine("```js")).toBe(true);
    expect(isFenceMarkerLine("```md")).toBe(true);
  });

  it("tolerates leading whitespace", () => {
    expect(isFenceMarkerLine("  ```")).toBe(true);
  });

  it("does not match text that merely contains backticks", () => {
    expect(isFenceMarkerLine("use `foo` to call")).toBe(false);
    expect(isFenceMarkerLine("text then ``` inline")).toBe(false);
  });
});

describe("iterateMarkdownBody", () => {
  it("skips lines inside fenced code blocks", () => {
    const md = ["body before", "```js", "codeLine1()", "codeLine2()", "```", "body after"].join(
      "\n",
    );
    const lines = Array.from(iterateMarkdownBody(md)).map((l) => l.trimmed);
    expect(lines).toEqual(["body before", "body after"]);
  });

  it("emits blank lines so callers can detect paragraph breaks", () => {
    const md = "first\n\nsecond";
    const lines = Array.from(iterateMarkdownBody(md));
    expect(lines.map((l) => ({ trimmed: l.trimmed, isBlank: l.isBlank }))).toEqual([
      { trimmed: "first", isBlank: false },
      { trimmed: "", isBlank: true },
      { trimmed: "second", isBlank: false },
    ]);
  });

  it("flags markdown headings with the correct level", () => {
    const md = "# h1\n## h2\n### h3\nbody";
    const lines = Array.from(iterateMarkdownBody(md));
    expect(lines.map((l) => ({ level: l.headingLevel, isHeading: l.isHeading }))).toEqual([
      { level: 1, isHeading: true },
      { level: 2, isHeading: true },
      { level: 3, isHeading: true },
      { level: 0, isHeading: false },
    ]);
  });

  it("does not flag text starting with # but no space as a heading", () => {
    const md = "#notAHeading\n# realHeading";
    const lines = Array.from(iterateMarkdownBody(md));
    expect(lines[0].isHeading).toBe(false);
    expect(lines[1].isHeading).toBe(true);
  });
});

describe("iterateAllMarkdownLines", () => {
  it("yields every line including fence markers and fenced content with inFence flags", () => {
    const md = ["outer", "```", "inner", "```", "tail"].join("\n");
    const events = Array.from(iterateAllMarkdownLines(md)).map((l) => ({
      raw: l.raw,
      inFence: l.inFence,
      isFenceMarker: l.isFenceMarker,
    }));

    expect(events).toEqual([
      { raw: "outer", inFence: false, isFenceMarker: false },
      { raw: "```", inFence: false, isFenceMarker: true },
      { raw: "inner", inFence: true, isFenceMarker: false },
      { raw: "```", inFence: true, isFenceMarker: true },
      { raw: "tail", inFence: false, isFenceMarker: false },
    ]);
  });
});
