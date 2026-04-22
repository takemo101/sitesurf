/**
 * Skill の `instructionsMarkdown` から prompt / user-message に出す要約や
 * extractor-scoped caution を取り出すためのユーティリティ群。
 *
 * ここの関数はすべて純粋関数で runtime には副作用を持たない。
 * system prompt 側と orchestration 側 (skill-detector) で同じロジックを
 * 共有するため shared に置く。
 */

import { iterateAllMarkdownLines, iterateMarkdownBody } from "./markdown-section";

export const INSTRUCTION_SUMMARY_MAX_LEN = 120;
export const CONTEXTUAL_PARAGRAPH_MAX_LINES = 4;

/**
 * 本文行を行配列として返す。見出し / コードフェンス内はスキップ。
 * 空行は paragraph 区切りとして空文字で保持する。
 */
function collectBodyLines(instructionsMarkdown: string): string[] {
  const out: string[] = [];
  for (const line of iterateMarkdownBody(instructionsMarkdown)) {
    if (line.isBlank) {
      out.push("");
      continue;
    }
    if (line.isHeading) continue;
    const cleaned = line.trimmed.replace(/^[-*+]\s+/, "").trim();
    if (cleaned.length === 0) continue;
    out.push(cleaned);
  }
  return out;
}

export function clampSummaryLength(line: string): string {
  if (line.length <= INSTRUCTION_SUMMARY_MAX_LEN) return line;
  return `${line.slice(0, INSTRUCTION_SUMMARY_MAX_LEN - 1)}…`;
}

/**
 * extractor-scoped section (`## Extractor: <id>`) を markdown から除去する。
 * 次の `##` 見出しが来るまで、あるいは最後まで読み飛ばす。
 * 上位の passive / contextual summary が extractor 専用 caution を取り込まない
 * ようにするため。fence 内部は section marker とみなさない。
 */
export function stripExtractorSections(instructionsMarkdown: string): string {
  const out: string[] = [];
  let inExtractorBlock = false;
  for (const { raw, trimmed, inFence, isFenceMarker } of iterateAllMarkdownLines(
    instructionsMarkdown,
  )) {
    if (isFenceMarker || inFence) {
      inExtractorBlock = false;
      out.push(raw);
      continue;
    }
    const isExtractorHeading = /^##\s+Extractor:\s+.+$/.test(trimmed);
    const isOtherHeading = !isExtractorHeading && /^##\s+/.test(trimmed);
    if (isExtractorHeading) {
      inExtractorBlock = true;
      continue;
    }
    if (isOtherHeading) {
      inExtractorBlock = false;
    }
    if (inExtractorBlock) continue;
    out.push(raw);
  }
  return out.join("\n");
}

/**
 * instructionsMarkdown の先頭本文から 1 行のサマリを作る (passive activation)。
 * 見出し / 空行 / リスト記号 / コードフェンス内は除去し、
 * INSTRUCTION_SUMMARY_MAX_LEN で打ち切る。
 * extractor 専用 caution は extractor bullet 側で扱うので summary には含めない。
 */
export function summarizeInstructions(instructionsMarkdown: string | undefined): string | null {
  if (!instructionsMarkdown) return null;
  const topLevel = stripExtractorSections(instructionsMarkdown);
  for (const line of collectBodyLines(topLevel)) {
    if (line === "") continue;
    return clampSummaryLength(line);
  }
  return null;
}

/**
 * contextual activation 用に先頭パラグラフ (連続本文行の塊) を返す。
 * 最大 CONTEXTUAL_PARAGRAPH_MAX_LINES 行まで。全文注入は避ける。
 * extractor 専用 caution は extractor bullet 側で扱うのでここには含めない。
 */
export function contextualInstructionParagraph(instructionsMarkdown: string): string[] {
  const topLevel = stripExtractorSections(instructionsMarkdown);
  const collected: string[] = [];
  let started = false;
  for (const line of collectBodyLines(topLevel)) {
    if (line === "") {
      if (started) break;
      continue;
    }
    started = true;
    collected.push(clampSummaryLength(line));
    if (collected.length >= CONTEXTUAL_PARAGRAPH_MAX_LINES) break;
  }
  return collected;
}

/**
 * `## Extractor: <id>` ブロック直下の本文を extractor ごとに抽出する。
 * extractor ID をキーに、本文の 1 行目 (passive summary と同じ切り詰め) を値として返す。
 * 他のセクションがあるまで本文を読む。全文注入はしない (1 行に要約)。
 */
export function extractExtractorCautions(
  instructionsMarkdown: string | undefined,
): Map<string, string> {
  const result = new Map<string, string>();
  if (!instructionsMarkdown) return result;

  let currentId: string | null = null;
  let currentBody: string[] = [];

  const finalize = () => {
    if (!currentId) return;
    for (const body of currentBody) {
      if (body === "") continue;
      result.set(currentId, clampSummaryLength(body));
      break;
    }
    currentId = null;
    currentBody = [];
  };

  for (const line of iterateMarkdownBody(instructionsMarkdown)) {
    const extractorMatch = /^##\s+Extractor:\s*(.+?)\s*$/.exec(line.trimmed);
    if (extractorMatch) {
      finalize();
      currentId = extractorMatch[1];
      continue;
    }
    if (line.isHeading) {
      finalize();
      continue;
    }

    if (currentId === null) continue;
    if (line.isBlank) {
      if (currentBody.length > 0) currentBody.push("");
      continue;
    }
    const cleaned = line.trimmed.replace(/^[-*+]\s+/, "").trim();
    if (cleaned.length > 0) currentBody.push(cleaned);
  }
  finalize();
  return result;
}
