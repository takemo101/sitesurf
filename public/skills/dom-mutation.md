---
id: dom-mutation
name: DOM Mutation
description: ページ上の要素を安全に加工する汎用DOM改変スキル
scope: global
selectors:
  - body
version: 1.0.0
---

## hideCookieModal

クッキーモーダル候補を非表示にし、変更件数を返す

```js
const consentTerms = ["cookie", "consent", "privacy", "gdpr", "tracking"];
const selectors = [
  '[id*="cookie"]',
  '[class*="cookie"]',
  '[data-testid*="cookie"]',
  '[aria-label*="cookie"]',
];

const changed = [];
for (const selector of selectors) {
  for (const el of document.querySelectorAll(selector)) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.sitesurfMutation === "hidden") continue;
    const text =
      `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`
        .toLowerCase()
        .trim();
    const style = window.getComputedStyle(el);
    const isConsentLike = consentTerms.some((term) => text.includes(term));
    const isOverlayLike =
      el.getAttribute("aria-modal") === "true" ||
      style.position === "fixed" ||
      Number.parseInt(style.zIndex || "0", 10) >= 1000;
    if (!isConsentLike || !isOverlayLike) continue;
    el.dataset.sitesurfMutation = "hidden";
    el.style.setProperty("display", "none", "important");
    changed.push(selector);
  }
}

return { ok: true, changed: changed.length, details: changed };
```

## injectHelperBanner

ページ上部に補助バナーを追加し、既にあれば再利用する

```js
const existing = document.getElementById("sitesurf-helper-banner");
if (existing instanceof HTMLElement) {
  existing.textContent = "SiteSurf helper is active";
  return { ok: true, changed: 0, details: ["banner-updated"] };
}

const banner = document.createElement("div");
banner.id = "sitesurf-helper-banner";
banner.textContent = "SiteSurf helper is active";
banner.style.position = "fixed";
banner.style.top = "12px";
banner.style.right = "12px";
banner.style.zIndex = "2147483647";
banner.style.padding = "8px 12px";
banner.style.borderRadius = "999px";
banner.style.background = "#1c7ed6";
banner.style.color = "#fff";
banner.style.fontSize = "12px";
banner.style.fontFamily = "system-ui, sans-serif";
document.body.appendChild(banner);

return { ok: true, changed: 1, details: ["banner-created"] };
```

## highlightTargets

見出しやボタンなど主要要素をハイライトし、変更件数を返す

```js
const selectors = ["h1", "h2", "button", "a", '[role="button"]'];
let changed = 0;

for (const selector of selectors) {
  for (const el of document.querySelectorAll(selector)) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.sitesurfMutation === "highlighted") continue;
    el.dataset.sitesurfMutation = "highlighted";
    el.style.outline = "2px solid #ff922b";
    el.style.outlineOffset = "2px";
    changed += 1;
  }
}

return { ok: true, changed, details: selectors };
```

## removeSticky

fixed/stickyなヘッダー・フッター・サイドバーを解除してスクロール領域を広げる

```js
const selectors = [
  "header",
  "footer",
  "nav",
  "aside",
  '[role="banner"]',
  '[role="navigation"]',
  '[role="contentinfo"]',
];
const changed = [];

for (const selector of selectors) {
  for (const el of document.querySelectorAll(selector)) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.sitesurfMutation === "unstuck") continue;
    const style = window.getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    const rect = el.getBoundingClientRect();
    const isBannerLike = rect.height < 200 && rect.width > window.innerWidth * 0.5;
    if (!isBannerLike) continue;
    el.dataset.sitesurfMutation = "unstuck";
    el.style.setProperty("position", "static", "important");
    changed.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
  }
}

return { ok: true, changed: changed.length, details: changed };
```

## removeOverlays

ニュースレター勧誘・ポップアップ・ペイウォール等のオーバーレイを非表示にする

```js
const overlayTerms = ["newsletter", "subscribe", "signup", "sign-up", "interstitial", "paywall"];
const changed = [];

for (const el of document.querySelectorAll("div, section, aside, [role='dialog']")) {
  if (!(el instanceof HTMLElement)) continue;
  if (el.dataset.sitesurfMutation) continue;
  const style = window.getComputedStyle(el);
  const isOverlay =
    el.getAttribute("aria-modal") === "true" ||
    el.getAttribute("role") === "dialog" ||
    (style.position === "fixed" && Number.parseInt(style.zIndex || "0", 10) >= 1000);
  if (!isOverlay) continue;
  const text =
    `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`
      .toLowerCase()
      .trim();
  const isTarget = overlayTerms.some((term) => text.includes(term));
  if (!isTarget) continue;
  el.dataset.sitesurfMutation = "hidden";
  el.style.setProperty("display", "none", "important");
  changed.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
}

return { ok: true, changed: changed.length, details: changed };
```

## shuffleList

ページ上の主要なリスト・テーブルの項目順をランダムにシャッフルする

```js
const containers = [...document.querySelectorAll("ul, ol, tbody")].filter((el) => {
  if (el.children.length < 2) return false;
  if (el.closest("nav")) return false;
  return true;
});
const changed = [];

for (const container of containers) {
  if (!(container instanceof HTMLElement)) continue;
  if (container.dataset.sitesurfMutation === "shuffled") continue;
  const items = Array.from(container.children);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  for (const item of items) {
    container.appendChild(item);
  }
  container.dataset.sitesurfMutation = "shuffled";
  changed.push(container.tagName.toLowerCase() + (container.id ? "#" + container.id : ""));
}

return { ok: true, changed: changed.length, details: changed };
```
