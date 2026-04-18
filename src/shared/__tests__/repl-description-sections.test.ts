import { describe, expect, it } from "vitest";
import { assembleReplDescriptionSections } from "../repl-description-sections";

const ALL_REPL_SECTION_KEYS = ["AVAILABLE_FUNCTIONS", "COMMON_PATTERNS"] as const;

describe("assembleReplDescriptionSections", () => {
  it("no longer includes Tool Philosophy in REPL descriptions", () => {
    const out = assembleReplDescriptionSections([...ALL_REPL_SECTION_KEYS]);
    expect(out).not.toContain("Tool Philosophy");
    expect(out).toContain("Available Functions");
    expect(out).toContain("Common Patterns");
  });

  it("デフォルト (enableBgFetch 省略) では bgFetch の signature と参照のみを含む", () => {
    const out = assembleReplDescriptionSections(["AVAILABLE_FUNCTIONS"]);
    expect(out).toContain("bgFetch(url, options?)");
    expect(out).toContain("詳しい使い分けは top-level `bg_fetch` tool description を参照");
    expect(out).not.toContain("5URL以上を取得する場合");
    expect(out).not.toContain("MAX_TURNS");
    expect(out).not.toContain("CORSを回避してあらゆるURLにアクセス可能");
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
    const out = assembleReplDescriptionSections([...ALL_REPL_SECTION_KEYS], {
      enableBgFetch: false,
    });
    expect(out).not.toContain("bgFetch");
    expect(out).not.toContain("Multi-URL fetch");
    expect(out).not.toContain("Multi-URL Fetch");
    // 無関係なセクションは残っている
    expect(out).toContain("REPL Persistence Model");
    expect(out).toContain("navigate(url)");
    expect(out).toContain("Multi-page Scraping");
  });

  it("AVAILABLE_FUNCTIONS は signature と1行説明の一覧に圧縮されている", () => {
    const out = assembleReplDescriptionSections(["AVAILABLE_FUNCTIONS"]);

    expect(out).toContain("| Function | Purpose |");
    expect(out).toContain("| `browserjs(fn, ...args)` | Read/scrape JSON-serializable data from the active page context. |");
    expect(out).toContain("| `returnFile(name, content, mimeType)` | Deliver a generated file to the user / Artifact Panel. |");
    expect(out).not.toContain("### Examples");
    expect(out).not.toContain("### When to Use");
    expect(out).not.toContain("### Do NOT Use browserjs() For");
  });

  it("Native Input は個別詳細ではなく signature 一覧のみを載せる", () => {
    const out = assembleReplDescriptionSections(["AVAILABLE_FUNCTIONS"]);

    expect(out).toContain(
      "Chrome debugger 経由で trusted な入力イベントを発火する。通常 DOM 操作で動かない bot 対策ページではこれを使う。",
    );
    expect(out).toContain("- `nativeClick(selector, options?)`");
    expect(out).toContain("- `nativeSelectText(selector, start?, end?)`");
    expect(out).not.toContain("options: { button?: \"left\" | \"right\" | \"middle\"");
    expect(out).not.toContain("// ✅ CORRECT: Form submission with native functions");
  });

  it("sentinel マーカは enableBgFetch の値に関係なく絶対に残さない", () => {
    for (const flag of [undefined, true, false]) {
      const options = flag === undefined ? undefined : { enableBgFetch: flag };
      const out = assembleReplDescriptionSections([...ALL_REPL_SECTION_KEYS], options);
      expect(out).not.toMatch(/BG_FETCH_SECTION_(START|END)/);
    }
  });
});
