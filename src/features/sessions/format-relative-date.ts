const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const diff = Date.now() - date.getTime();

  if (diff < MINUTE_MS) return "たった今";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}分前`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}時間前`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}日前`;

  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export function isOlderThan(isoDate: string, days: number): boolean {
  const date = new Date(isoDate);
  return Date.now() - date.getTime() > days * DAY_MS;
}
