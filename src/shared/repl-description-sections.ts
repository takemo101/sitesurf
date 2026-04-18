/**
 * @deprecated このファイルは後方互換性のために残しています。
 * 新規コードは `@/shared/prompt-sections` を直接インポートしてください。
 *
 * SSOT は `src/shared/prompt-sections/` に移動しました。
 */

export { AVAILABLE_FUNCTIONS, COMMON_PATTERNS, buildBgFetchHelperDescription } from "./prompt-sections";

export type ReplDescriptionSectionKey = "COMMON_PATTERNS" | "AVAILABLE_FUNCTIONS";

import { AVAILABLE_FUNCTIONS, COMMON_PATTERNS } from "./prompt-sections";

const SECTIONS: Record<ReplDescriptionSectionKey, string> = {
  COMMON_PATTERNS,
  AVAILABLE_FUNCTIONS,
};

// bgFetch 関連の部分は <!-- BG_FETCH_SECTION_START --> / <!-- BG_FETCH_SECTION_END -->
// で囲んである。enableBgFetch=false の時はマーカごと中身を削除し、AI から
// bgFetch の存在を隠す。true の時はマーカ行だけ取り除いて中身を残す。
//
// 同じマーカは system-prompt-v2 経由の prompt でも使われるため、本ヘルパは
// 両パスから再利用する。どちらの値でも sentinel 文字列自体は必ず取り除く。
const BG_FETCH_SECTION_RE = /^<!-- BG_FETCH_SECTION_START -->\n([\s\S]*?)^<!-- BG_FETCH_SECTION_END -->\n?/gm;

export function stripBgFetchSections(text: string, enableBgFetch: boolean): string {
  if (enableBgFetch) {
    return text.replace(BG_FETCH_SECTION_RE, (_match, body: string) => body);
  }
  return text.replace(BG_FETCH_SECTION_RE, "");
}

export function assembleReplDescriptionSections(
  keys: ReplDescriptionSectionKey[],
  options: { enableBgFetch?: boolean } = {},
): string {
  const joined = keys.map((key) => SECTIONS[key]).join("\n\n");
  return stripBgFetchSections(joined, options.enableBgFetch ?? true);
}
