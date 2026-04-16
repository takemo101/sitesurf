import { Readability } from "@mozilla/readability";
import type { ReadabilityMessage, ReadabilityResponse } from "@/shared/message-types";

const MAX_CONTENT_LENGTH = 100_000; // 100K chars

chrome.runtime.onMessage.addListener(
  (msg: ReadabilityMessage, _sender, sendResponse: (r: ReadabilityResponse) => void) => {
    if (msg.type !== "BG_READABILITY") return false;

    try {
      const doc = new DOMParser().parseFromString(msg.html, "text/html");

      // Set base URL for relative path resolution
      const base = doc.createElement("base");
      base.href = msg.url;
      doc.head.prepend(base);

      // Extract links before Readability modifies the DOM
      const contentRoot = doc.querySelector("main, article, [role='main']") ?? doc.body;
      const links = extractLinks(contentRoot, msg.url);

      const reader = new Readability(doc.cloneNode(true) as Document);
      const article = reader.parse();

      const title = article?.title || doc.title || "";
      let content =
        article && article.textContent && article.textContent.length > 100
          ? article.textContent.trim()
          : extractFallback(doc);

      // Truncate to prevent token explosion
      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.substring(0, MAX_CONTENT_LENGTH) + "\n... (truncated)";
      }

      sendResponse({ success: true, title, content, links });
    } catch (e) {
      sendResponse({
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return true;
  },
);

function extractLinks(root: Element, baseUrl: string): Array<{ text: string; href: string }> {
  const seen = new Set<string>();
  const links: Array<{ text: string; href: string }> = [];

  for (const a of root.querySelectorAll("a[href]")) {
    const text = a.textContent?.trim() ?? "";
    if (!text) continue;

    try {
      const href = new URL(a.getAttribute("href")!, baseUrl).href;
      if (seen.has(href) || !href.startsWith("http")) continue;
      seen.add(href);
      links.push({ text, href });
    } catch {
      // Invalid URL — skip
    }
  }

  return links;
}

function extractFallback(doc: Document): string {
  const selectors = ["main", "article", '[role="main"]', ".main-content", ".content"];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el && el.textContent && el.textContent.trim().length > 200) {
      return el.textContent.trim();
    }
  }
  // Truncate body fallback too
  const bodyText = doc.body?.textContent?.trim() ?? "";
  return bodyText.length > MAX_CONTENT_LENGTH
    ? bodyText.substring(0, MAX_CONTENT_LENGTH) + "\n... (truncated)"
    : bodyText;
}
