// トークン関連の定数
export const DEFAULT_MAX_TOKENS = 8192;
export const MIN_TOKENS = 1024;
export const MAX_TOKENS = 32768;
export const TOKENS_STEP = 1024;

// スライダーのマーク
export const TOKEN_MARKS = [
  { value: 4096, label: "4K" },
  { value: 8192, label: "8K" },
  { value: 16384, label: "16K" },
  { value: 32768, label: "32K" },
] as const;
