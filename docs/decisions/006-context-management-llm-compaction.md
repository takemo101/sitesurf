# 006: コンテキスト管理は LLM 圧縮で一本化（ToolResultStore は廃止）

## 状態

承認済（2026-04 / PR #69 で実装）

## 文脈

v0.1.3 までのコンテキスト管理は [tool-result-context-v2.md](../design/tool-result-context-v2.md) の通り「層構造 + 段階リリース」を計画していた。

- Layer 1: `estimateTokens` v2 + `ContextBudget`
- Layer 2: 訪問URL追跡 + 2段階 truncate
- **Layer 3: `ToolResultStore` + `get_tool_result` ツール（IndexedDB に完全結果を保存し、AI が必要時に pull）**
- Layer 4: LLM 構造化圧縮（ローリング要約）
- Layer 5: UI

Layer 3 は Wave 2 として実装まで漕ぎ着けたが、ドッグフーディングで以下が観測された:

- AI が `get_tool_result` の存在を忘れて再実行（`navigate` / `read_page`）してしまうケースが頻発
- 履歴の `Stored: tool_result://...` 行が prefix キャッシュを毎ターン無効化し、OpenAI 自動キャッシュのヒット率が著しく低下
- ストアと履歴の二重管理で `[構造化要約]` との整合（圧縮後の参照キーの再導出）が複雑化
- マルチタブ / マルチセッションの境界条件（sessionId 切替時の race）に常に気を払う必要がある
- 一方で Layer 4 の構造化要約だけでも 32k 窓のセッションが十分長く持続することが計測で判明

## 決定

**Layer 3 を完全に廃止し、コンテキスト圧縮は Layer 4（LLM 構造化要約）に一本化する。**

具体的には:

1. `ToolResultStore` Port / `IndexedDBToolResultStore` Adapter / `ResultSummarizer` を削除
2. `get_tool_result` ツールを削除
3. `ContextBudget.useToolResultStore` フィールドを削除（Layer 3 の ON/OFF が不要になったため）
4. クラウドプロバイダの `autoCompact` デフォルトを **`false` → `true` に変更**（PR #66）。圧縮 LLM 呼び出しのコストを払ってでも「忘れない」を優先
5. 旧形式セッションに残る `Stored: tool_result://` / `Use get_tool_result(...)` 行は読み込み時に剥がす（`LEGACY_*_MARKER_RE`）

## 結果

### 良い面

- コードベースが 1500行以上削減され、context-manager のロジックが追跡しやすくなった
- OpenAI 自動キャッシュのヒット率が回復
- 構造化要約はプロバイダ非依存で動き、Anthropic/OpenAI/Google/ローカルすべてで同じ体験になる
- 設定 UI から Layer 3 関連項目が消え、ユーザの選択肢が単純化（自動圧縮の ON/OFF だけ）

### 悪い面

- 「Web 状態（ログイン後ページ等）の完全版を保持して後から取り戻す」という当初の独自価値は失われた
- 構造化要約は LLM 呼び出しコストを発生させる（クラウドの autoCompact は ON がデフォルト）
- 超長期セッション（100+ ターン）での情報損失耐性は要約の品質依存

### 中立

- `tool-result-context-v2.md` は Layer 3 の設計議論の記録として保存（HISTORICAL マーク）
- 将来「Web 状態の完全版保持」が再び必要になった場合は、artifact storage（既存）を拡張する形で再導入する余地がある

## 関連 PR / Issue

- PR #36 / #48: Layer 3 初期実装
- PR #62 / #63 / #64 / #65: Layer 3 のチューニングと診断ログ
- PR #66: autoCompact デフォルト ON 化
- PR #68: `[構造化要約]` 残骸の永続化前除去
- PR #69: Layer 3（`get_tool_result` / `ToolResultStore`）の完全削除
- Issue #67 / #53: pi-mono 方式（LLM 圧縮）への合意

## 参照

- [tool-result-context-v2.md](../design/tool-result-context-v2.md) §5.5 — 現行アーキテクチャ概要
- [agent-loop-detail.md](../design/agent-loop-detail.md) — `prepareMessagesForTurn` の流れ
- `src/orchestration/context-{compressor,manager}.ts` — 実装本体
- `src/features/ai/structured-summary-prompt.ts` — 圧縮プロンプト
