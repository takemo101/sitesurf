import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractHostname,
  normalizeUrl,
  pruneVisitedUrls,
  trackSpaDomainsFromBgFetch,
  trackVisitedUrl,
} from "../visited-url-tracker";
import type { VisitedUrlEntry } from "@/features/ai";

let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("normalizeUrl", () => {
  it("末尾スラッシュを削る", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("末尾スラッシュがない場合はそのまま返す", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("パスの途中のスラッシュは保持する", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe("https://example.com/path");
  });
});

describe("extractHostname", () => {
  it("有効なURLからホスト名を取り出す", () => {
    expect(extractHostname("https://example.com/page")).toBe("example.com");
  });

  it("パース不能な文字列は入力をそのまま返す", () => {
    expect(extractHostname("not a url")).toBe("not a url");
  });
});

describe("trackVisitedUrl", () => {
  function makeMap(): Map<string, VisitedUrlEntry> {
    return new Map<string, VisitedUrlEntry>();
  }

  it("同じ URL を訪問すると visitCount が増える", () => {
    const map = makeMap();
    trackVisitedUrl(map, "https://example.com/", "Example", "navigate");
    trackVisitedUrl(map, "https://example.com/", "Example", "navigate");
    const entry = map.get("https://example.com");
    expect(entry?.visitCount).toBe(2);
  });

  it("末尾スラッシュを正規化して重複扱いにする", () => {
    const map = makeMap();
    trackVisitedUrl(map, "https://example.com/", "Example", "navigate");
    trackVisitedUrl(map, "https://example.com", "Example", "navigate");
    expect(map.size).toBe(1);
    expect(map.get("https://example.com")?.visitCount).toBe(2);
  });

  it("再訪時はログ出力する", () => {
    trackVisitedUrl(makeMap(), "https://warmup.example", "Warmup", "navigate");
    consoleInfoSpy.mockClear();

    const map = makeMap();
    trackVisitedUrl(map, "https://example.com", "Example", "navigate");
    trackVisitedUrl(map, "https://example.com", "Example", "navigate");

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[SiteSurf:agent-loop]",
      "visitedUrl revisit count",
      expect.objectContaining({
        url: "https://example.com",
        visitCount: 2,
        method: "navigate",
      }),
    );
  });

  it("lastMethod が反映される", () => {
    const map = makeMap();
    trackVisitedUrl(map, "https://example.com", "Example", "navigate");
    trackVisitedUrl(map, "https://example.com", "Example", "bg_fetch");
    expect(map.get("https://example.com")?.lastMethod).toBe("bg_fetch");
  });
});

describe("pruneVisitedUrls", () => {
  function makeEntry(visitCount: number, visitedAt: number): VisitedUrlEntry {
    return {
      url: "https://example.com",
      title: "Example",
      visitedAt,
      visitCount,
      lastMethod: "navigate",
    };
  }

  it("20件以下なら何もしない", () => {
    const map = new Map<string, VisitedUrlEntry>();
    for (let i = 0; i < 20; i++) {
      map.set(`url-${i}`, makeEntry(1, i));
    }
    pruneVisitedUrls(map);
    expect(map.size).toBe(20);
  });

  it("21件目で一番古いエントリを落とす", () => {
    const map = new Map<string, VisitedUrlEntry>();
    for (let i = 0; i < 20; i++) {
      map.set(`url-${i}`, makeEntry(2, i));
    }
    map.set("url-20", makeEntry(2, 20));
    pruneVisitedUrls(map);
    expect(map.size).toBe(20);
    expect(map.has("url-0")).toBe(false);
  });

  it("visitCount が低いエントリを優先的に落とす", () => {
    const map = new Map<string, VisitedUrlEntry>();
    for (let i = 0; i < 20; i++) {
      map.set(`url-${i}`, makeEntry(3, i));
    }
    map.set("url-low", makeEntry(1, 999));
    pruneVisitedUrls(map);
    expect(map.size).toBe(20);
    expect(map.has("url-low")).toBe(false);
  });
});

describe("trackSpaDomainsFromBgFetch", () => {
  it("spaWarning 付き結果のホスト名を検出セットに登録する", () => {
    const set = new Set<string>();
    trackSpaDomainsFromBgFetch(set, {
      url: "https://spa.example.com/app",
      spaWarning: "detected",
    });
    expect(set.has("spa.example.com")).toBe(true);
  });

  it("登録済みドメインに再度 bg_fetch すると警告文字列を返す", () => {
    const set = new Set<string>(["spa.example.com"]);
    const warning = trackSpaDomainsFromBgFetch(set, {
      url: "https://spa.example.com/another",
    });
    expect(warning).toContain("spa.example.com");
    expect(warning).toContain("SPA/CSR site");
  });

  it("未登録ドメインには警告を出さない", () => {
    const set = new Set<string>();
    const warning = trackSpaDomainsFromBgFetch(set, {
      url: "https://normal.example.com/page",
    });
    expect(warning).toBe("");
  });

  it("配列形式の toolValue も処理する", () => {
    const set = new Set<string>();
    trackSpaDomainsFromBgFetch(set, [
      { url: "https://spa1.example.com/a", spaWarning: "yes" },
      { url: "https://spa2.example.com/b", spaWarning: "yes" },
    ]);
    expect(set.has("spa1.example.com")).toBe(true);
    expect(set.has("spa2.example.com")).toBe(true);
  });

  it("パース不能な入力では例外を投げず空文字列を返す", () => {
    const set = new Set<string>();
    const warning = trackSpaDomainsFromBgFetch(set, { url: "not-a-url" });
    expect(warning).toBe("");
  });
});
