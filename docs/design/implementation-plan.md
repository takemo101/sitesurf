# 実装計画: ツール結果コンテキスト管理 v2

> 設計書: [`tool-result-context-v2.md`](./tool-result-context-v2.md)  
> この文書は v2 設計を **AI 実装エージェントが着手可能な issue 粒度** に分解したもの。各 issue は単一セッションで完結できるサイズに絞り、受け入れ条件と参照箇所を明示する。

## 全体構成

```
第1弾 (Wave 1): 基盤 + 軽量介入          ← まず全員着手（3-5日）
  └─ Issue W1-1 〜 W1-6（6 issues）

第2弾 (Wave 2): Web拡張固有の永続化      ← 計測後に発動判断（2-3週）
  ├─ Issue W2-0（スパイク）
  └─ Issue W2-1 〜 W2-5（5 issues）

第3弾 (Wave 3): LLM 構造化圧縮           ← 超長期用（1-2週）
  └─ Issue W3-1 〜 W3-3（3 issues）

第4弾 (Wave 4): UI                        ← 任意
  └─ Issue W4-1 〜 W4-2（2 issues）
```

## Wave 別の依存関係とリリース戦略

### Wave 1（全プロバイダ対応、独立リリース可）

| Issue | 依存 | 並列可？ |
|---|---|---|
| W1-1: estimateTokens v2 | なし | ✓ |
| W1-2: ContextBudget + 計測ログ | W1-1 | W1-4/W1-5 と並列 |
| W1-3: agent-loop ハードコード差し替え | W1-2 | - |
| W1-4: COMPRESS_THRESHOLDS/buildMessagesForAPI 統合 | W1-2 | W1-3 の後 |
| W1-5: URL 訪問追跡 + system prompt 注入 | なし | 並列可 |
| W1-6: 2段階 truncate 実装 | W1-3 | W1-3 の後 |

**推奨順序**: W1-1 → W1-2 → (W1-3 ‖ W1-5) → W1-4 → W1-6

### Wave 2（小窓特化、スパイク必須）

| Issue | 依存 |
|---|---|
| W2-0: スパイク（tool_result 差し替え検証） | **第2弾の最初に必須** |
| W2-1: ToolResultStorePort + IndexedDB adapter | W2-0 |
| W2-2: ResultSummarizer + shouldStore | なし（W2-1 と並列可） |
| W2-3: get_tool_result ツール + 動的登録 | W2-1, W2-2 |
| W2-4: executeToolCall 改修 | W2-1, W2-2 |
| W2-5: ContextManager（新設） | W2-4 |

### Wave 3（超長期対応）

| Issue | 依存 |
|---|---|
| W3-1: 構造化要約プロンプト + テストハーネス | なし |
| W3-2: compressMessagesIfNeeded 新設 | W3-1 |
| W3-3: ContextManager Step C 統合 + userConfirmed UI | W2-5, W3-2 |

### Wave 4（UI、任意）

| Issue | 依存 |
|---|---|
| W4-1: ツール結果展開ボタン | W2-1 |
| W4-2: 自動圧縮設定 UI | W3-3 |

---

## Issue 粒度の考え方

各 issue は以下を満たす粒度にする：

- **1 issue = 1 PR** 目安
- AI が単一セッション内で完結できる作業量（~300-500 行の変更、テスト含め）
- 受け入れ条件が測定可能（テストで検証できる）
- 参照コード箇所を絶対パス + 定数名/関数名で指定（行番号は流動的なので避ける）
- 依存 issue を `Blocked by: #NNN` 形式で明記

---

## 実装 issue 一覧（詳細は GitHub issue 本体参照）

### Wave 1

| # | 概要 | 新規ファイル | 改修ファイル | 想定行数 |
|---|---|---|---|---|
| W1-1 | `estimateTokens` v2 | - | `src/shared/token-utils.ts` + test | ~80 |
| W1-2 | `ContextBudget` + 計測ログ | `src/features/ai/context-budget.ts` + test | `src/orchestration/agent-loop.ts` | ~200 |
| W1-3 | agent-loop ハードコード差し替え | - | `src/orchestration/agent-loop.ts` + test | ~80 |
| W1-4 | COMPRESS_THRESHOLDS/buildMessagesForAPI 統合 | - | `src/orchestration/context-compressor.ts` + test | ~100 |
| W1-5 | URL 訪問追跡 + system prompt 注入 | - | `src/orchestration/agent-loop.ts`, `src/features/ai/system-prompt-v2.ts` + test | ~150 |
| W1-6 | 2段階 truncate 実装 | - | `src/orchestration/agent-loop.ts` | ~50 |

### Wave 2

| # | 概要 | 新規ファイル | 改修ファイル | 想定行数 |
|---|---|---|---|---|
| W2-0 | スパイク | `docs/spike/tool-result-rewrite.md`（結果レポ） | - | - |
| W2-1 | ToolResultStore Port + Adapter | `src/ports/tool-result-store.ts`, `src/adapters/storage/indexeddb-tool-result-store.ts` + test | `src/orchestration/agent-loop.ts`（deps 注入） | ~400 |
| W2-2 | ResultSummarizer + shouldStore | `src/features/tools/result-summarizer.ts` + test | - | ~300 |
| W2-3 | get_tool_result ツール + 動的登録 | `src/features/tools/get-tool-result.ts` + test | `src/features/tools/index.ts`, `src/features/ai/system-prompt-v2.ts` | ~200 |
| W2-4 | executeToolCall 改修 | - | `src/orchestration/agent-loop.ts` + test | ~250 |
| W2-5 | ContextManager 新設 | `src/orchestration/context-manager.ts` + test | `src/orchestration/agent-loop.ts`（置き換え） | ~350 |

### Wave 3

| # | 概要 | 新規ファイル | 改修ファイル | 想定行数 |
|---|---|---|---|---|
| W3-1 | 構造化要約プロンプト | `src/features/ai/structured-summary-prompt.ts` + test | - | ~150 |
| W3-2 | compressMessagesIfNeeded | - | `src/orchestration/context-compressor.ts` + test | ~200 |
| W3-3 | ContextManager Step C 統合 + 設定UI | - | `src/orchestration/context-manager.ts`, `src/features/settings/settings-store.ts`, `SettingsPanel.tsx` + test | ~250 |

### Wave 4

| # | 概要 | 新規ファイル | 改修ファイル | 想定行数 |
|---|---|---|---|---|
| W4-1 | ツール結果展開ボタン | - | `src/features/chat/ToolCallBlock.tsx`, `src/features/chat/ChatBubble.tsx` + test | ~200 |
| W4-2 | 自動圧縮設定 UI | - | `SettingsPanel.tsx` | ~80 |

---

## Branch 戦略

- **`main`** — 安定ブランチ
- **`takemo101/wave-1-*`** — Wave 1 の各 issue ブランチ（feat 粒度）
- Wave 1 全体の統合テストが必要なら `takemo101/wave-1-integration` を別途

PR タイトル規約（既存コミット履歴を参考）:
- `feat: Wave 1-1 — estimateTokens v2 実装`
- `refactor: Wave 1-4 — COMPRESS_THRESHOLDS を ContextBudget に統合`

## テスト戦略

各 issue ごとに以下を担保：

1. 単体テスト（新規ファイルに対して）
2. 既存テストの緑維持（回帰確認）
3. Wave 1 完了時点で `agent-loop.test.ts` にシナリオテスト 1-2 本追加（32k 想定、URL追跡、計測ログ出力）

## リリース判定と計測

Wave 1 完了 → 2週間運用 → 計測データ確認 → Wave 2 発動可否を判断。

計測確認項目（D-L1-5 参照）:
- 使用モデル窓の分布（< 40k / 40-80k / ≥80k）
- セッション長分布（ターン数）
- `trimThreshold` 到達率
- URL ループ発生率（同一 URL への 3 回以上訪問）
