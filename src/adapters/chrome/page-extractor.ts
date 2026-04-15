export interface LightweightExtraction {
  h1: string;
  description: string;
  text: string;
  method: string;
}

/**
 * chrome.scripting.executeScript の func 引数として使用する軽量ページ抽出関数。
 * ページコンテキスト制約: クロージャ外の変数はシリアライズ後に参照できないため、
 * すべての定数・ヘルパーを関数内に閉じ込めている。リファクタリング時に外に出さないこと。
 */
export function extractPageContentLightweight(): LightweightExtraction {
  const MAX_TEXT_LENGTH = 6000;
  const REMOVE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "header",
    "footer",
    "aside",
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
    "[aria-hidden='true']",
  ];
  const MAIN_SELECTORS = [
    "article",
    "main",
    '[role="main"]',
    ".content",
    "#content",
    ".post",
    ".entry",
  ];
  const MIN_TEXT_LENGTH = 50;

  function removeNoise(container: Element): void {
    for (const sel of REMOVE_SELECTORS) {
      for (const el of container.querySelectorAll(sel)) {
        el.remove();
      }
    }
  }

  function cleanText(raw: string): string {
    return raw.replace(/\s+/g, " ").trim();
  }

  const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";

  for (const selector of MAIN_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el) continue;

    const clone = el.cloneNode(true) as Element;
    removeNoise(clone);
    const text = cleanText(clone.textContent ?? "");

    if (text.length < MIN_TEXT_LENGTH) continue;

    return {
      h1,
      description,
      text: text.substring(0, MAX_TEXT_LENGTH),
      method: selector,
    };
  }

  const bodyClone = document.body.cloneNode(true) as Element;
  removeNoise(bodyClone);
  const bodyText = cleanText(bodyClone.textContent ?? "");

  return {
    h1,
    description,
    text: bodyText.substring(0, MAX_TEXT_LENGTH),
    method: "body",
  };
}
