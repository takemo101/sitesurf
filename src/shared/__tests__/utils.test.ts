import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep, formatRelativeDate, isOlderThan, isExcludedUrl, getLastKnownUrl } from "../utils";

describe("sleep", () => {
  it("指定ミリ秒後に解決する", async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe("formatRelativeDate", () => {
  const NOW = new Date("2025-06-15T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1分未満は「たった今」", () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("たった今");
  });

  it("1分は「1分前」", () => {
    const iso = new Date(NOW - 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("1分前");
  });

  it("59分は「59分前」", () => {
    const iso = new Date(NOW - 59 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("59分前");
  });

  it("1時間は「1時間前」", () => {
    const iso = new Date(NOW - 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("1時間前");
  });

  it("23時間は「23時間前」", () => {
    const iso = new Date(NOW - 23 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("23時間前");
  });

  it("1日は「1日前」", () => {
    const iso = new Date(NOW - 24 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("1日前");
  });

  it("6日は「6日前」", () => {
    const iso = new Date(NOW - 6 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("6日前");
  });

  it("7日は「1週間前」", () => {
    const iso = new Date(NOW - 7 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe("1週間前");
  });

  it("30日以上はローカライズ日付", () => {
    const iso = new Date(NOW - 31 * 24 * 60 * 60_000).toISOString();
    const result = formatRelativeDate(iso);
    expect(result).toMatch(/\d/);
  });
});

describe("isOlderThan", () => {
  const NOW = new Date("2025-06-15T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("指定日数より古い場合 true", () => {
    const iso = new Date(NOW - 8 * 24 * 60 * 60_000).toISOString();
    expect(isOlderThan(iso, 7)).toBe(true);
  });

  it("指定日数未満の場合 false", () => {
    const iso = new Date(NOW - 6 * 24 * 60 * 60_000).toISOString();
    expect(isOlderThan(iso, 7)).toBe(false);
  });

  it("ちょうど指定日数の場合 false", () => {
    const iso = new Date(NOW - 7 * 24 * 60 * 60_000).toISOString();
    expect(isOlderThan(iso, 7)).toBe(false);
  });
});

describe("isExcludedUrl", () => {
  it("chrome:// を除外", () => {
    expect(isExcludedUrl("chrome://extensions/")).toBe(true);
  });

  it("chrome://newtab を除外", () => {
    expect(isExcludedUrl("chrome://newtab")).toBe(true);
  });

  it("chrome-extension:// を除外", () => {
    expect(isExcludedUrl("chrome-extension://abc/index.html")).toBe(true);
  });

  it("extension:// を除外", () => {
    expect(isExcludedUrl("extension://abc/index.html")).toBe(true);
  });

  it("通常の https URL は許可", () => {
    expect(isExcludedUrl("https://example.com")).toBe(false);
  });

  it("http URL は許可", () => {
    expect(isExcludedUrl("http://localhost:3000")).toBe(false);
  });

  it("chrome を含むホスト名の https URL は許可", () => {
    expect(isExcludedUrl("https://chromestatus.com")).toBe(false);
  });

  it("devtools:// を除外", () => {
    expect(isExcludedUrl("devtools://devtools/bundled/inspector.html")).toBe(true);
  });

  it("about:blank を除外", () => {
    expect(isExcludedUrl("about:blank")).toBe(true);
  });
});

describe("getLastKnownUrl", () => {
  it("navigation メッセージの URL を返す", () => {
    const messages = [
      { role: "user" },
      { role: "navigation", url: "https://a.com" },
      { role: "assistant" },
    ];
    expect(getLastKnownUrl(messages)).toBe("https://a.com");
  });

  it("最後の navigation メッセージの URL を返す", () => {
    const messages = [
      { role: "navigation", url: "https://a.com" },
      { role: "user" },
      { role: "navigation", url: "https://b.com" },
    ];
    expect(getLastKnownUrl(messages)).toBe("https://b.com");
  });

  it("navigation メッセージがなければ null", () => {
    const messages = [{ role: "user" }, { role: "assistant" }];
    expect(getLastKnownUrl(messages)).toBeNull();
  });

  it("空配列は null", () => {
    expect(getLastKnownUrl([])).toBeNull();
  });

  it("url がない navigation メッセージは無視", () => {
    const messages = [{ role: "navigation" }, { role: "user" }];
    expect(getLastKnownUrl(messages)).toBeNull();
  });
});
