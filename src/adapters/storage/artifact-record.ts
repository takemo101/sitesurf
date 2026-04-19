import type { ArtifactKind, ArtifactMeta } from "@/ports/artifact-storage";

/**
 * Artifact の storage 内部表現。
 * `ArtifactMeta` の全 field に加えて、実データ (data | bytes) と
 * session-scoped key / sessionId を持つ。
 *
 * - in-memory / IndexedDB の両 Adapter、および indexeddb-database.ts の
 *   upgrade 時 migration で同じ shape を流用する
 * - 型定義が乖離すると Adapter 間の挙動が drift する (ADR-007 統合レビュー
 *   で発見、#151) ため共有型として集約する
 */
export interface StoredArtifactRecord extends ArtifactMeta {
  key: string;
  sessionId: string | null;
  kind: ArtifactKind;
  /** kind === "json" のときだけ存在 */
  data?: unknown;
  /** kind === "file" のときだけ存在 */
  bytes?: Uint8Array;
}

export const GLOBAL_SESSION_KEY = "__global__";

export function createArtifactKey(sessionId: string | null, name: string): string {
  return `${sessionId ?? GLOBAL_SESSION_KEY}::${name}`;
}
