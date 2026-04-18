import { describe, expect, it } from "vitest";
import { assembleReplDescriptionSections } from "../repl-description-sections";

describe("assembleReplDescriptionSections", () => {
  it("デフォルト (enableBgFetch 省略) では bgFetch の signature と参照を含む", () => {
    const out = assembleReplDescriptionSections(["AVAILABLE_FUNCTIONS"]);
    expect(out).toContain("bgFetch(url, options?)");
    expect(out).toContain("詳しい使い分けは top-level `bg_fetch` tool description を参照");
    expect(out).not.toContain("Fetch an external URL via the background service worker");
    // sentinel 行は出力に残してはいけない
    expect(out).not.toContain("BG_FETCH_SECTION_START");
    expect(out).not.toContain("BG_FETCH_SECTION_END");
  });

  it("enableBgFetch=true でも同様に bgFetch の signature と参照を含む", () => {
    const out = assembleReplDescriptionSections(["AVAILABLE_FUNCTIONS"], {
      enableBgFetch: true,
    });
    expect(out).toContain("bgFetch(url, options?)");
    expect(out).toContain("詳しい使い分けは top-level `bg_fetch` tool description を参照");
    expect(out).not.toContain("BG_FETCH_SECTION_START");
  });

  it("enableBgFetch=false の時は bgFetch 関連を全削除する", () => {
    const out = assembleReplDescriptionSections(
      ["AVAILABLE_FUNCTIONS", "COMMON_PATTERNS"],
      { enableBgFetch: false },
    );
    expect(out).not.toContain("bgFetch");
    expect(out).not.toContain("Multi-URL fetch");
    expect(out).not.toContain("Multi-URL Fetch");
    // 無関係なセクションは残っている
    expect(out).toContain("REPL Persistence Model");
    expect(out).toContain("navigate(url)");
    expect(out).toContain("Multi-page Scraping");
  });

  it("sentinel マーカは enableBgFetch の値に関係なく絶対に残さない", () => {
    for (const flag of [undefined, true, false]) {
      const options = flag === undefined ? undefined : { enableBgFetch: flag };
      const out = assembleReplDescriptionSections(
        ["AVAILABLE_FUNCTIONS", "COMMON_PATTERNS"],
        options,
      );
      expect(out).not.toMatch(/BG_FETCH_SECTION_(START|END)/);
    }
  });
});
