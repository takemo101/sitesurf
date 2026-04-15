import { describe, expect, it } from "vitest";

import { formatRelativeDate, isOlderThan } from "../format-relative-date";

describe("formatRelativeDate", () => {
  it("直近は「たった今」を返す", () => {
    const now = new Date().toISOString();
    expect(formatRelativeDate(now)).toBe("たった今");
  });

  it("数分前を返す", () => {
    const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(date)).toBe("5分前");
  });

  it("数時間前を返す", () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(date)).toBe("3時間前");
  });

  it("数日前を返す", () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(date)).toBe("2日前");
  });

  it("7日以上前は月日を返す", () => {
    const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeDate(date);
    expect(result).toMatch(/\d+月\d+日/);
  });
});

describe("isOlderThan", () => {
  it("指定日数より古いとtrueを返す", () => {
    const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isOlderThan(date, 7)).toBe(true);
  });

  it("指定日数より新しいとfalseを返す", () => {
    const date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(isOlderThan(date, 7)).toBe(false);
  });
});
