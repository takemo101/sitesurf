import { createLogger } from "@/shared/logger";
import type { VisitedUrlEntry } from "@/features/ai";

const log = createLogger("agent-loop");

/**
 * システムプロンプトに載せる "Current Session: Visited URLs" の上限。
 * これを超えたら訪問回数が少なく古いエントリから順に落とす。
 */
export const MAX_VISITED_URLS = 20;

/** 末尾スラッシュを除去してURLを正規化する */
export function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** URLからホスト名を抽出する（パース失敗時はURLをそのまま返す） */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 訪問済み URL をトラッキングする。system prompt の "Current Session: Visited URLs"
 * セクションに反映されるほか、重複ログの抑制にも使う。
 *
 * 以前は `visitCount >= URL_REVISIT_THRESHOLD` で警告を返却していたが、
 * 同一 URL を正当に何度も参照するワークフロー（ドキュメント参照、状態確認等）
 * があるため撤廃。必要なら AI は履歴から前回の取得結果を直接参照できる。
 */
export function trackVisitedUrl(
  visitedUrls: Map<string, VisitedUrlEntry>,
  url: string,
  title: string,
  method: VisitedUrlEntry["lastMethod"],
): void {
  const normalized = normalizeUrl(url);
  const existing = visitedUrls.get(normalized);
  const entry: VisitedUrlEntry = {
    url,
    title,
    visitedAt: Date.now(),
    visitCount: (existing?.visitCount ?? 0) + 1,
    lastMethod: method,
  };
  visitedUrls.set(normalized, entry);
  pruneVisitedUrls(visitedUrls);

  if (entry.visitCount > 1) {
    log.info("visitedUrl revisit count", {
      url: normalized,
      title,
      method,
      visitCount: entry.visitCount,
    });
  }
}

/** MAX_VISITED_URLS を超えたとき、訪問回数が少なく古いエントリを削除する */
export function pruneVisitedUrls(visitedUrls: Map<string, VisitedUrlEntry>): void {
  if (visitedUrls.size <= MAX_VISITED_URLS) return;
  const entries = [...visitedUrls.entries()];
  entries.sort(([, a], [, b]) => {
    if (a.visitCount !== b.visitCount) return a.visitCount - b.visitCount;
    return a.visitedAt - b.visitedAt;
  });
  const toRemove = entries.length - MAX_VISITED_URLS;
  for (let i = 0; i < toRemove; i++) {
    visitedUrls.delete(entries[i][0]);
  }
}

/**
 * bg_fetch 結果から SPA ドメインを検出・追跡し、警告メッセージを返す。
 *
 * - `spaWarning` が含まれる結果のホスト名を `spaDetectedDomains` に登録する
 * - すでに SPA と判明しているドメインへの bg_fetch に対しては警告文字列を返す
 *
 * @returns AI に返すツール結果末尾に追記する警告文字列（該当なしなら空文字列）
 */
export function trackSpaDomainsFromBgFetch(
  spaDetectedDomains: Set<string>,
  toolValue: unknown,
): string {
  let warning = "";
  try {
    const items = Array.isArray(toolValue) ? toolValue : [toolValue];
    for (const item of items) {
      const it = item as { url?: string; spaWarning?: string };
      if (!it.url) continue;
      // spaWarning があればドメインを登録
      if (it.spaWarning) {
        spaDetectedDomains.add(new URL(it.url).hostname);
      } else {
        // spaWarning がなくても既知 SPA ドメインなら警告
        const host = new URL(it.url).hostname;
        if (spaDetectedDomains.has(host)) {
          warning += `\n\n⚠️ WARNING: The domain "${host}" was previously detected as a SPA/CSR site. bg_fetch cannot retrieve JS-rendered content from this domain. Use navigate() + repl with readPage()/browserjs() instead.`;
        }
      }
    }
  } catch {
    // Ignore
  }
  return warning;
}
