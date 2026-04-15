import { describe, expect, it } from "vitest";
import { buildElementContext } from "../InputArea";
import type { ElementInfo } from "@/ports/browser-executor";

const baseElement: ElementInfo = {
  selector: "div.product-card > h2.title",
  tagName: "h2",
  text: "MacBook Pro 14インチ",
  html: "<h2>MacBook Pro 14インチ</h2>",
  attributes: { class: "title" },
  boundingBox: { x: 0, y: 0, width: 200, height: 30 },
  surroundingHTML: '<div class="product-card"><h2>MacBook Pro 14インチ</h2></div>',
};

describe("buildElementContext", () => {
  it("要素情報とユーザーテキストを合成する", () => {
    const result = buildElementContext(baseElement, "この商品の価格を教えて");

    expect(result).toContain("[選択された要素]");
    expect(result).toContain("セレクタ: div.product-card > h2.title");
    expect(result).toContain("タグ: <h2>");
    expect(result).toContain("テキスト: MacBook Pro 14インチ");
    expect(result).toContain("周辺DOM:");
    expect(result).toContain("この商品の価格を教えて");
  });

  it("ユーザーテキストが空でも要素情報だけ返す", () => {
    const result = buildElementContext(baseElement, "");

    expect(result).toContain("[選択された要素]");
    expect(result).toContain("セレクタ: div.product-card > h2.title");
    expect(result).not.toContain("\n\n\n");
  });

  it("surroundingHTML がない場合は周辺DOMを含めない", () => {
    const elementNoSurround: ElementInfo = {
      ...baseElement,
      surroundingHTML: "",
    };
    const result = buildElementContext(elementNoSurround, "テスト");

    expect(result).not.toContain("周辺DOM:");
    expect(result).toContain("テスト");
  });

  it("テキストが100文字を超える場合は切り詰める", () => {
    const longTextElement: ElementInfo = {
      ...baseElement,
      text: "あ".repeat(200),
    };
    const result = buildElementContext(longTextElement, "確認");

    expect(result).toContain("テキスト: " + "あ".repeat(100));
    expect(result).not.toContain("あ".repeat(101));
  });

  it("text が空の場合は (なし) を表示", () => {
    const noTextElement: ElementInfo = {
      ...baseElement,
      text: "",
    };
    const result = buildElementContext(noTextElement, "テスト");

    expect(result).toContain("テキスト: (なし)");
  });
});
