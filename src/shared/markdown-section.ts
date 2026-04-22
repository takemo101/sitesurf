/**
 * fence-aware な markdown line 走査ユーティリティ。
 *
 * skill の instructionsMarkdown を扱う際、`# Instructions` / `# Extractors` のような
 * top-level marker や `## Extractor:` block を検出したいが、fenced code block
 * (\`\`\`...\`\`\`) 内に同じ見出し文字列が書かれても marker として扱ってはいけない。
 * この fence tracking を複数箇所で個別実装するとずれが生まれるため、
 * 共通の走査インターフェースに集約する。
 */

/** ``` で始まる code fence の開閉行かどうかを判定する。 */
export function isFenceMarkerLine(raw: string): boolean {
  return /^\s*```/.test(raw);
}

export interface MarkdownBodyLine {
  /** 元の文字列 (trim 前)。 */
  raw: string;
  /** trim() 済みの文字列。 */
  trimmed: string;
  /** 空行 (trim 後に長さ 0) かどうか。 */
  isBlank: boolean;
  /** `# ` 始まりの見出しかどうか。 */
  isHeading: boolean;
  /** 見出しレベル (1-6)。非見出しは 0。 */
  headingLevel: number;
}

/**
 * fenced code block を読み飛ばしながら markdown 本文を 1 行ずつ yield する。
 * fence marker 行自体も yield しない。空行は `isBlank: true` で yield するので、
 * 呼び出し側で paragraph 区切りとして利用できる。
 */
export function* iterateMarkdownBody(markdown: string): Generator<MarkdownBodyLine> {
  let inFence = false;
  for (const raw of markdown.split("\n")) {
    if (isFenceMarkerLine(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const trimmed = raw.trim();
    const headingMatch = /^(#{1,6})\s/.exec(trimmed);
    yield {
      raw,
      trimmed,
      isBlank: trimmed.length === 0,
      isHeading: headingMatch !== null,
      headingLevel: headingMatch ? headingMatch[1].length : 0,
    };
  }
}

export interface MarkdownLineWithFence {
  raw: string;
  trimmed: string;
  inFence: boolean;
  isFenceMarker: boolean;
}

/**
 * fence marker 行や fence 内部も含めて全行を yield する。
 * 出力 markdown を再構築する caller (例: セクション除去) 向け。
 */
export function* iterateAllMarkdownLines(markdown: string): Generator<MarkdownLineWithFence> {
  let inFence = false;
  for (const raw of markdown.split("\n")) {
    const isFenceMarker = isFenceMarkerLine(raw);
    yield {
      raw,
      trimmed: raw.trim(),
      inFence,
      isFenceMarker,
    };
    if (isFenceMarker) inFence = !inFence;
  }
}
