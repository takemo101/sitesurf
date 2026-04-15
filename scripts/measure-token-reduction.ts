/**
 * トークン削減効果の測定スクリプト
 *
 * 新旧の抽出方式のトークン消費を比較し、削減率を計算する。
 *
 * 使い方: npx tsx scripts/measure-token-reduction.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- 型定義 ---

interface TestPage {
  id: string;
  type: string;
  description: string;
  html: string;
}

interface TestPages {
  pages: TestPage[];
}

interface ExtractionResult {
  text: string;
  tokenEstimate: number;
}

interface MeasurementResult {
  pageId: string;
  pageType: string;
  legacy: ExtractionResult;
  lightweight: ExtractionResult;
  reductionRate: number;
}

// --- トークン推定 ---

/**
 * 文字列のトークン数を推定する。
 * GPT系モデルでは約4文字≒1トークン（英語）、日本語は約1.5文字≒1トークン。
 * ここでは混合テキスト向けに加重平均で推定する。
 */
function estimateTokens(text: string): number {
  let asciiChars = 0;
  let nonAsciiChars = 0;

  for (const char of text) {
    if (char.charCodeAt(0) <= 127) {
      asciiChars++;
    } else {
      nonAsciiChars++;
    }
  }

  const asciiTokens = asciiChars / 4;
  const nonAsciiTokens = nonAsciiChars / 1.5;

  return Math.ceil(asciiTokens + nonAsciiTokens);
}

// --- 旧方式: simplifiedDOM（HTMLタグ付き） ---

/**
 * 旧方式のsimplifiedDOM抽出をシミュレートする。
 * HTMLタグを残したまま、script/style を除去して返す。
 */
function extractLegacy(html: string): string {
  let result = html;

  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  result = result.replace(/\s+/g, " ").replace(/> </g, ">\n<").trim();

  return result;
}

// --- 新方式: 軽量プレーンテキスト抽出 ---

const MAIN_SELECTORS = [
  "article",
  "main",
  '[role="main"]',
  ".content",
  "#content",
  "#search-results",
  ".post",
  ".entry",
];

const MAX_TEXT_LENGTH = 6000;

/**
 * 新方式の軽量抽出をシミュレートする。
 * HTMLからプレーンテキストのみを抽出する。
 */
function extractLightweight(html: string): string {
  const title = extractTagContent(html, "title");
  const h1 = extractTagContent(html, "h1");
  const metaDescription = extractMetaDescription(html);

  const mainContent = extractMainContent(html);

  const parts = [title, h1, metaDescription, mainContent].filter(Boolean);

  return parts.join("\n\n").substring(0, MAX_TEXT_LENGTH);
}

/**
 * 指定タグの内容を取得する。
 */
function extractTagContent(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = html.match(regex);
  if (!match) return "";
  return stripTags(match[1]).trim();
}

/**
 * meta descriptionを取得する。
 */
function extractMetaDescription(html: string): string {
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return match?.[1] ?? "";
}

/**
 * メインコンテンツ領域を検出してテキストを抽出する。
 */
function extractMainContent(html: string): string {
  for (const selector of MAIN_SELECTORS) {
    const content = extractBySelector(html, selector);
    if (content) return content;
  }

  return extractBodyText(html);
}

/**
 * CSSセレクタに対応するHTML要素の内容を抽出する。
 * 簡易実装: タグ名、id、classのみ対応。
 */
function extractBySelector(html: string, selector: string): string {
  let regex: RegExp;

  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    regex = new RegExp(`<([a-z][a-z0-9]*)\\s[^>]*id="${id}"[^>]*>[\\s\\S]*?</\\1>`, "i");
  } else if (selector.startsWith(".")) {
    const cls = selector.slice(1);
    regex = new RegExp(
      `<([a-z][a-z0-9]*)\\s[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>[\\s\\S]*?</\\1>`,
      "i",
    );
  } else if (selector.startsWith("[")) {
    const attrMatch = selector.match(/\[([^=]+)="([^"]+)"\]/);
    if (!attrMatch) return "";
    regex = new RegExp(
      `<([a-z][a-z0-9]*)\\s[^>]*${attrMatch[1]}="${attrMatch[2]}"[^>]*>[\\s\\S]*?</\\1>`,
      "i",
    );
  } else {
    regex = new RegExp(`<${selector}[^>]*>[\\s\\S]*?</${selector}>`, "i");
  }

  const match = html.match(regex);
  if (!match) return "";

  const text = stripTags(match[0]).trim();
  return text.length > 50 ? text : "";
}

/**
 * body要素のテキストを抽出する（フォールバック）。
 */
function extractBodyText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return stripTags(html).trim();

  let body = bodyMatch[1];
  body = body.replace(/<(header|footer|nav|aside|script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");

  return stripTags(body).trim();
}

/**
 * HTMLタグを除去してプレーンテキストにする。
 */
function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- 測定実行 ---

function measurePage(page: TestPage): MeasurementResult {
  const legacyText = extractLegacy(page.html);
  const lightweightText = extractLightweight(page.html);

  const legacyTokens = estimateTokens(legacyText);
  const lightweightTokens = estimateTokens(lightweightText);

  const reductionRate = ((legacyTokens - lightweightTokens) / legacyTokens) * 100;

  return {
    pageId: page.id,
    pageType: page.type,
    legacy: { text: legacyText, tokenEstimate: legacyTokens },
    lightweight: { text: lightweightText, tokenEstimate: lightweightTokens },
    reductionRate,
  };
}

// --- レポート出力 ---

function printReport(results: MeasurementResult[]): void {
  console.log("=".repeat(70));
  console.log("  トークン削減効果 測定レポート");
  console.log("=".repeat(70));
  console.log();

  console.log("■ ページ別結果");
  console.log("-".repeat(70));
  console.log(
    `${"ページタイプ".padEnd(20)} ${"旧方式".padStart(10)} ${"新方式".padStart(10)} ${"削減率".padStart(10)}`,
  );
  console.log("-".repeat(70));

  for (const r of results) {
    console.log(
      `${r.pageType.padEnd(20)} ${String(r.legacy.tokenEstimate).padStart(10)} ${String(r.lightweight.tokenEstimate).padStart(10)} ${`${r.reductionRate.toFixed(1)}%`.padStart(10)}`,
    );
  }
  console.log("-".repeat(70));

  const avgLegacy = results.reduce((sum, r) => sum + r.legacy.tokenEstimate, 0) / results.length;
  const avgLightweight =
    results.reduce((sum, r) => sum + r.lightweight.tokenEstimate, 0) / results.length;
  const avgReduction = results.reduce((sum, r) => sum + r.reductionRate, 0) / results.length;

  console.log(
    `${"平均".padEnd(20)} ${String(Math.round(avgLegacy)).padStart(10)} ${String(Math.round(avgLightweight)).padStart(10)} ${`${avgReduction.toFixed(1)}%`.padStart(10)}`,
  );

  console.log();
  console.log("■ サマリー");
  console.log(`  平均削減率: ${avgReduction.toFixed(1)}%`);
  console.log(`  旧方式 平均トークン: ${Math.round(avgLegacy)}`);
  console.log(`  新方式 平均トークン: ${Math.round(avgLightweight)}`);
  console.log();

  const target = avgReduction >= 50;
  console.log(`■ 目標達成: ${target ? "✅ 達成（50%以上の削減）" : "❌ 未達成"}`);

  console.log();
  console.log("■ 抽出内容プレビュー（先頭200文字）");
  console.log("-".repeat(70));
  for (const r of results) {
    console.log(`\n[${r.pageType}] 新方式:`);
    console.log(r.lightweight.text.substring(0, 200));
  }

  console.log();
  console.log("=".repeat(70));
}

// --- メイン ---

function main(): void {
  const testPagesPath = resolve(import.meta.dirname!, "test-pages.json");
  const raw = readFileSync(testPagesPath, "utf-8");
  const testPages: TestPages = JSON.parse(raw);

  const results = testPages.pages.map(measurePage);

  printReport(results);
}

main();
