export interface OutlineItem {
  level: 1 | 2 | 3;
  text: string;
}

export interface LightweightExtraction {
  h1: string;
  description: string;
  text: string;
  method: string;
  outline: OutlineItem[];
}

/**
 * chrome.scripting.executeScript の func 引数として使用する軽量ページ抽出関数。
 * ページコンテキスト制約: クロージャ外の変数はシリアライズ後に参照できないため、
 * すべての定数・ヘルパーを関数内に閉じ込めている。リファクタリング時に外に出さないこと。
 */
export function extractPageContentLightweight(): LightweightExtraction {
  const MAX_TEXT_LENGTH = 6000;
  const MAX_OUTLINE_ITEMS = 30;
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
  const EXCLUDE_HEADING_ANCESTORS =
    "nav,header,footer,aside,[role='navigation'],[role='banner'],[role='contentinfo'],[aria-hidden='true']";
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

  const outline: OutlineItem[] = [];
  for (const h of document.querySelectorAll("h1,h2,h3")) {
    if ((h as Element).closest(EXCLUDE_HEADING_ANCESTORS)) continue;
    const text = cleanText(h.textContent ?? "");
    if (!text) continue;
    const level = (h.tagName === "H1" ? 1 : h.tagName === "H2" ? 2 : 3) as 1 | 2 | 3;
    outline.push({ level, text });
    if (outline.length >= MAX_OUTLINE_ITEMS) break;
  }

  const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";

  const seenElements: Element[] = [];
  const matchedMethods: string[] = [];
  const sectionTexts: string[] = [];

  for (const selector of MAIN_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) {
      if (seenElements.some((s) => s.contains(el) || el.contains(s))) continue;

      const clone = el.cloneNode(true) as Element;
      removeNoise(clone);
      const text = cleanText(clone.textContent ?? "");

      if (text.length < MIN_TEXT_LENGTH) continue;

      seenElements.push(el);
      if (!matchedMethods.includes(selector)) matchedMethods.push(selector);
      sectionTexts.push(text);
    }
  }

  if (sectionTexts.length > 0) {
    const joined = sectionTexts.join("\n\n");
    return {
      h1,
      description,
      text: joined.substring(0, MAX_TEXT_LENGTH),
      method: matchedMethods.join(","),
      outline,
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
    outline,
  };
}
