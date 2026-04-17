import { describe, expect, it } from "vitest";
import {
  formatRetrievedToolResult,
  formatStoredToolResultSummary,
  restoreRetrievedToolResultToSummary,
  shouldStore,
  summarizeToolResult,
} from "../result-summarizer";

describe("result-summarizer", () => {
  it("summarizes read_page results with url and preview", () => {
    const summary = summarizeToolResult({
      toolName: "read_page",
      args: {},
      fullResult: JSON.stringify({ text: "Welcome to SiteSurf" }),
      rawValue: { text: "Welcome to SiteSurf\nThis is the body" },
      isError: false,
      currentUrl: "https://example.com",
    });

    expect(summary).toContain("URL: https://example.com");
    expect(summary).toContain("Body preview:");
  });

  it("does not store short results", () => {
    expect(
      shouldStore({
        toolName: "read_page",
        fullResult: "x".repeat(499),
        summary: "short",
        isError: false,
      }),
    ).toBe(false);
  });

  it("does not store when summary and full result are nearly identical", () => {
    expect(
      shouldStore({
        toolName: "read_page",
        fullResult: "x".repeat(700),
        summary: "x".repeat(550),
        isError: false,
      }),
    ).toBe(false);
  });

  it("restores fetched full content back to stored summary format", () => {
    const full = formatRetrievedToolResult({
      key: "tc_abc",
      toolName: "read_page",
      fullValue: "FULL CONTENT",
      summary: "Body preview: hello",
    });

    expect(restoreRetrievedToolResultToSummary(full)).toBe(
      formatStoredToolResultSummary("read_page", "Body preview: hello", "tc_abc"),
    );
  });
});
