# tool_result 差し替えスパイク

Issue #36 / Wave 2-0 の事前確認メモ。

## 結論

- SiteSurf の現在実装は Vercel AI SDK の UI message / `toSDKMessages` を直接使っていない。
- 代わりに `src/ports/ai-provider.ts` の独自 `AIMessage` 形式を `runAgentLoop()` で保持し、各アダプタへそのまま渡している。
- そのため **Layer 3 の「tool result を後から要約へ差し替える」処理はアプリ側メッセージ配列の書き換えで実装可能**。
- `node_modules/ai/src/ui/convert-to-model-messages.ts` を確認した限り、AI SDK 側も `toolCallId` / `tool-result` を入力配列から都度組み立てる実装で、 immutable な内部参照に依存していない。

## 確認内容

### 1. SiteSurf 側の実際の経路

- `src/orchestration/agent-loop.ts`
  - `messages: AIMessage[]` を自前で保持
  - 各ターン前に `manageContextMessages()` で内容を書き換え
  - `aiProvider.streamText({ messages, ... })` にそのまま渡す
- `src/ports/ai-provider.ts`
  - `ToolResultMessage` は単純な `{ role: "tool", toolCallId, toolName, result }`
  - `result` は文字列なので、要約文字列への置換が容易

### 2. Vercel AI SDK 側の確認

- `node_modules/ai/src/ui/convert-to-model-messages.ts`
  - `toolCallId` と `tool-result` を入力パーツから毎回変換している
  - 変換前オブジェクトの identity 固定を前提とした実装は見当たらない
- `node_modules/ai/docs/03-agents/04-loop-control.mdx`
  - `prepareStep` 内で tool result を要約して送る例があり、送信前の message 変換は想定ユースケース

## 実装判断

- Wave 2 は **tool result 本体を Store に退避し、履歴上は summary + key に置換する方針で進める**。
- `get_tool_result` で pull 取得した完全版も、次ターン以降は再び summary へ戻す。
- live provider 実験（Anthropic / OpenAI / Google / local の実 API 呼び出し）はこの worktree では未実施。必要なら別途手動確認を追加する。
