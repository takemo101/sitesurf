import { describe, expect, it } from "vitest";
import { detectType, getMimeType } from "../types";

describe("detectType", () => {
  it.each([
    ["data.json", "json"],
    ["page.html", "html"],
    ["page.htm", "html"],
    ["README.md", "markdown"],
    ["README.markdown", "markdown"],
    ["notes.txt", "text"],
    ["data.csv", "text"],
    ["photo.png", "image"],
    ["photo.jpg", "image"],
    ["photo.jpeg", "image"],
    ["anim.gif", "image"],
    ["img.webp", "image"],
    ["icon.svg", "image"],
    ["archive.zip", "binary"],
    ["noextension", "binary"],
  ] as const)("%s => %s", (name, expected) => {
    expect(detectType(name)).toBe(expected);
  });
});

describe("getMimeType", () => {
  it.each([
    ["photo.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["anim.gif", "image/gif"],
    ["img.webp", "image/webp"],
    ["icon.svg", "image/svg+xml"],
    ["archive.zip", "application/octet-stream"],
    ["data.json", "application/octet-stream"],
  ] as const)("%s => %s", (name, expected) => {
    expect(getMimeType(name)).toBe(expected);
  });
});
