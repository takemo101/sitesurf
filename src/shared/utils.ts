/** 指定ミリ秒待機する */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ISO 8601 の日時を相対表示に変換 */
export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

/** ISO 8601 の日時が指定日数以上前かを判定 */
export function isOlderThan(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() > days * 24 * 60 * 60 * 1000;
}

/** chrome://, chrome-extension://, extension:// 等のスクリプト注入不可ページを判定 */
export function isExcludedUrl(url: string): boolean {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("chrome-untrusted://") ||
    url.startsWith("extension://") ||
    url.startsWith("devtools://") ||
    url.startsWith("about:")
  );
}

/** メッセージ配列から最後の navigation メッセージの URL を返す。なければ null */
export function getLastKnownUrl(
  messages: readonly { role: string; url?: string }[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "navigation" && messages[i].url) {
      return messages[i].url!;
    }
  }
  return null;
}
