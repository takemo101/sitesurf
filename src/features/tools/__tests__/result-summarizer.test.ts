import { describe, expect, it } from "vitest";
import {
  formatRetrievedToolResult,
  formatStoredToolResultSummary,
  restoreRetrievedToolResultToSummary,
  shouldStore,
  summarizeToolResult,
} from "../result-summarizer";

describe("result-summarizer", () => {
  it("summarizes read_page results with method, url and preview", () => {
    const summary = summarizeToolResult({
      toolName: "read_page",
      args: {},
      fullResult: JSON.stringify({ text: "Welcome to SiteSurf" }),
      rawValue: {
        text: "Welcome to SiteSurf\nThis is the body",
        simplifiedDom: "[Extraction: article]",
      },
      isError: false,
      currentUrl: "https://example.com",
    });

    expect(summary).toContain("URL: https://example.com");
    expect(summary).toContain("method: article");
    expect(summary).toContain("Body preview:");
  });

  it("summarizes navigate results with status when available", () => {
    const summary = summarizeToolResult({
      toolName: "navigate",
      args: { url: "https://example.com" },
      fullResult: JSON.stringify({ finalUrl: "https://example.com", status: 200 }),
      rawValue: { finalUrl: "https://example.com", status: 200 },
      isError: false,
    });

    expect(summary).toBe("→ https://example.com (status: 200)");
  });

  it("keeps navigate summaries stable when status is unavailable", () => {
    const summary = summarizeToolResult({
      toolName: "navigate",
      args: { url: "https://example.com" },
      fullResult: JSON.stringify({ finalUrl: "https://example.com" }),
      rawValue: { finalUrl: "https://example.com" },
      isError: false,
    });

    expect(summary).toBe("→ https://example.com");
  });

  it("summarizes artifacts get results with size in bytes", () => {
    const summary = summarizeToolResult({
      toolName: "artifacts",
      args: { command: "get", filename: "notes.txt" },
      fullResult: "あa",
      rawValue: "あa",
      isError: false,
    });

    expect(summary).toBe("notes.txt (4 bytes)");
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

  it("keeps storing long read_page results after adding method to the summary", () => {
    const fullResult = JSON.stringify({ text: "x".repeat(700) });
    const summary = summarizeToolResult({
      toolName: "read_page",
      args: {},
      fullResult,
      rawValue: {
        text: `Heading\n${"x".repeat(700)}`,
        simplifiedDom: "[Extraction: article]",
      },
      isError: false,
      currentUrl: "https://example.com",
    });

    expect(
      shouldStore({
        toolName: "read_page",
        fullResult,
        summary,
        isError: false,
      }),
    ).toBe(true);
  });

  it("keeps read_page summaries within 300 characters", () => {
    const summary = summarizeToolResult({
      toolName: "read_page",
      args: {},
      fullResult: JSON.stringify({ text: "x".repeat(1000) }),
      rawValue: {
        text: `Heading\n${"x".repeat(1000)}`,
        simplifiedDom: "[Extraction: article]",
      },
      isError: false,
      currentUrl: "https://example.com/path",
    });

    expect(summary.length).toBeLessThanOrEqual(300);
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
