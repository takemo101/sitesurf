# agent-loop 詳細設計

## 概要

`orchestration/agent-loop.ts` はアプリケーションの心臓部。
AIProvider・ツール・チャット・セッション保存を結合するオーケストレーター。

## 公開 API

```typescript
// orchestration/agent-loop.ts

export interface AgentLoopDeps {
  createAIProvider: (settings: Settings) => AIProvider;
  browserExecutor: BrowserExecutor;
  authProvider?: AuthProvider;
  securityMiddleware?: SecurityMiddleware;
}

export interface AgentLoopParams {
  deps: AgentLoopDeps;
  chatStore: ChatActions;
  settings: Settings; // provider/model/maxTokens/autoCompact 等
  session: Session;
  tools: ToolDefinition[];
  systemPrompt: string;
  autoSaver: AutoSaver;
  toolExecutor: ToolExecutor;
  skillRegistry: SkillRegistry;
  credentials?: AuthCredentials;
  onCredentialsUpdate?: (creds: AuthCredentials | null) => void;
}

export async function runAgentLoop(params: AgentLoopParams): Promise<void>;
```

> **削除済み**: `onCompressNeeded` callback は廃止された。圧縮の発動は `settings.autoCompact`
> （クラウドのデフォルトは `true`、ローカル/Ollama は常時 ON）と
> `ContextBudget.trimThreshold` で `prepareMessagesForTurn` 内で完結する。

## ターン開始前のコンテキスト整形

各ターンの先頭で `prepareMessagesForTurn`（`orchestration/context-manager.ts`）を呼び、以下を順に行う:

1. `normalizeContextMessages` — 各 `tool` メッセージの結果を `budget.maxToolResultChars` で切り詰め（スクリーンショットは `[screenshot captured]` に置換）
2. `estimateTokens(messages) < budget.trimThreshold` ならそのまま返す
3. 超えていたら `compressMessagesIfNeeded` を呼び、構造化要約 LLM で末尾20kトークン以外を要約
4. それでも閾値内に収まらない場合は `trimMessagesToThreshold` で古い `tool`/`assistant` メッセージを順に splice（最終手段）

`ContextBudget` は `getContextBudget(settings.model, settings.maxTokens)` でターン先頭に算出する。窓サイズ（実装値）と各閾値の対応は [tool-result-context-v2.md §5.5](./tool-result-context-v2.md#55-現行アーキテクチャ概要実装済みssot) を参照。

### 構造化要約メッセージの扱い

圧縮が走ると、履歴先頭に `[構造化要約]\n…` を本文に持つ `user` メッセージが差し込まれる（`STRUCTURED_SUMMARY_MESSAGE_PREFIX`）。

- `compressMessagesIfNeeded` は既存要約 + 新規履歴を入力に渡してローリング更新する
- セッション永続化前に `toPersistedHistory` が `[構造化要約]` 行を剥がし、`session.summary` 側で別途保持する
- 旧形式（`Stored: tool_result://` / `Use get_tool_result(...)`）の残骸は `LEGACY_*_MARKER_RE` で読み込み時に除去される（PR #69 で `get_tool_result` ツール自体は廃止済み）

## ツール結果のセキュリティ処理

`runAgentLoop` は各ツール結果を AI に返す前に `SecurityMiddleware.processToolOutput` を通す:

- `settings.enableSecurityMiddleware === true`（デフォルト ON）かつ結果に `data:image/` が含まれない場合のみ実行
- プロンプトインジェクションらしき文字列を検出すると、AI への結果は安全な要約だけに置き換え、ユーザにはシステムメッセージで警告
- 監査ログは IndexedDB に追記され、設定 → セキュリティタブから lazy load で閲覧できる

詳細: [security-middleware-design.md](./security-middleware-design.md)

## 訪問URL追跡

`trackVisitedUrl` は `Map<normalizedUrl, VisitedUrlEntry>` を保持し、system prompt の "Current Session: Visited URLs" セクションに反映する。

- `MAX_VISITED_URLS = 20` を超えたら `pruneVisitedUrls` が visitCount の少ない・古いエントリから削除
- `lastMethod` は `"navigate" | "read_page" | "bg_fetch"` のいずれか
- **再訪問の警告閾値は撤廃済み**（PR #75）: 同一 URL を何度参照しても警告メッセージは追加されない。AI は履歴の前回結果を直接参照する想定

`bg_fetch` 結果が SPA を示唆する `spaWarning` を含む場合は `spaDetectedDomains: Set<string>` に登録し、同ドメインへの後続 `bg_fetch` でツール結果に「`navigate()` + `read_page`/`browserjs()` を使え」という警告を追記する。

## messages の管理方針

**agent-loop はローカル `messages` 配列で作業し、finally で ChatSlice に同期する。**

理由:

- AI SDK に渡す messages は Port の `AIMessage[]` 型であり、ChatSlice の `ChatMessage[]` とは形式が異なる
- ループ途中で ChatSlice を直接操作すると、ツール呼出しの途中結果とストリーミングの混在で不整合が起きやすい
- finally で一括同期すれば、エラーやキャンセル時も確実に同期される

```
ループ開始
  ├─ messages = buildMessagesForAPI(session)  // session.history + summary から構築
  ├─ ループ内で messages.push() (ローカル操作)
  └─ finally → chatStore.syncHistory(messages)  // ChatSlice.history を丸ごと置換
```

### ChatSlice の UI表示用更新

`messages` のローカル操作とは別に、UI表示用の ChatSlice アクションはリアルタイムで呼ぶ:

- `chatStore.appendDelta(text)` — ストリーミングテキスト
- `chatStore.addToolCall(...)` — ToolCallBlock 追加
- `chatStore.updateToolCallResult(...)` — ツール結果
- `chatStore.startNewAssistantMessage()` — 次のターン開始

これらは `ChatMessage[]` (UI用) を更新する。`AIMessage[]` (API用) は `messages` ローカル配列。

## スキルシステムとの統合

### SkillDetectionMessage

スキルが検出された場合、AIに自動的に通知される。

```typescript
// orchestration/skill-detector.ts

export interface SkillDetectionMessage {
  role: "system";
  content: string;
}

export function buildSkillDetectionMessage(matches: SkillMatch[]): SkillDetectionMessage | null {
  if (matches.length === 0) return null;

  const lines = matches.map((m) => {
    const extractors = m.availableExtractors.map((e) => `  - ${e.id}: ${e.description}`).join("\n");
    return `Skill "${m.skill.name}" is available:\n${extractors}`;
  });

  return {
    role: "system",
    content: `Available skills for current page:\n\n${lines.join("\n\n")}\n\nUse these skills in browserjs() via window.${matches[0].skill.id}.${matches[0].availableExtractors[0].id}()`,
  };
}
```

### messages 構築時の統合

```typescript
function buildMessagesForAPI(
  session: Session,
  chatMessages: ChatMessage[],
  currentUrl: string,
  skillRegistry: SkillRegistry,
): AIMessage[] {
  const messages: AIMessage[] = [];

  // 1. システムプロンプト
  messages.push({ role: "system", content: SYSTEM_PROMPT });

  // 2. セッションサマリー（圧縮済みの場合）
  if (session.summary) {
    messages.push({ role: "system", content: `Previous context: ${session.summary}` });
  }

  // 3. スキル検出メッセージ（重要：ユーザー/アシスタントメッセージより先に）
  const skillMatches = skillRegistry.findMatchingSkills(currentUrl);
  const skillMessage = buildSkillDetectionMessage(skillMatches);
  if (skillMessage) {
    messages.push(skillMessage);
  }

  // 4. チャット履歴
  for (const chatMsg of chatMessages) {
    if (chatMsg.role === "navigation") {
      messages.push(convertNavigationForAPI(chatMsg));
    } else {
      messages.push(convertChatMessageForAPI(chatMsg));
    }
  }

  return messages;
}
```

### スキル検出のタイミング

1. **ページ遷移時** - URLが変わるたびにスキルを再検出
2. **repl ツール実行時** - マッチングスキルを sandbox に注入
3. **ターン開始時** - messages 構築時に最新のスキル情報を含める

### repl 実行時のスキル注入

```typescript
// features/tools/repl.ts

export async function executeRepl(
  browser: BrowserExecutor,
  artifactStorage: ArtifactStoragePort,
  args: { title?: string; code: string },
  skillRegistry: SkillRegistry, // 追加
  signal?: AbortSignal,
): Promise<Result<ReplResult, ToolError>> {
  // 現在のタブURLを取得
  const tab = await browser.getActiveTab();

  // マッチングスキルを検索
  const skillMatches = skillRegistry.findMatchingSkills(tab.url || "");

  // sandbox用にフォーマット
  const skills = formatSkillsForSandbox(skillMatches);

  // sandboxに注入して実行
  sandbox.contentWindow!.postMessage(
    {
      type: "exec",
      id: execId,
      code: args.code,
      skills, // スキル情報を渡す
    },
    "*",
  );

  // ...
}
```

### formatSkillsForSandbox

```typescript
// features/tools/skills/formatters.ts

export interface SandboxSkillInfo {
  readonly [skillId: string]: {
    readonly name: string;
    readonly description: string;
    readonly extractors: {
      readonly [extractorId: string]: {
        readonly name: string;
        readonly description: string;
        readonly code: string;
        readonly outputSchema: string;
      };
    };
  };
}

export function formatSkillsForSandbox(matches: SkillMatch[]): SandboxSkillInfo {
  const result: Record<string, SandboxSkillInfo[string]> = {};

  for (const match of matches) {
    const extractors: Record<string, SandboxSkillInfo[string]["extractors"][string]> = {};

    for (const ext of match.availableExtractors) {
      extractors[ext.id] = {
        name: ext.name,
        description: ext.description,
        code: ext.code,
        outputSchema: ext.outputSchema,
      };
    }

    result[match.skill.id] = {
      name: match.skill.name,
      description: match.skill.description,
      extractors,
    };
  }

  return result;
}
```

## NavigationMessage の扱い

### 問題

`feature-spec.md` F-10 で `role: "navigation"` メッセージを定義しているが、
AI APIは `user | assistant | tool` のみ受け付ける。

### 解決: NavigationMessage は ChatMessage 専用。AI には user メッセージとして変換

```typescript
// orchestration/navigation-converter.ts

/** ChatMessage の navigation ロールを AIMessage の user ロールに変換する */
export function convertNavigationForAPI(nav: NavigationChatMessage): AIMessage {
  return {
    role: "user",
    content: [{ type: "text", text: `[ページ遷移] ${nav.title}\nURL: ${nav.url}` }],
  };
}
```

### タブ追跡との統合

ストリーミング中にタブ変更が発生した場合:

```typescript
// sidepanel/App.tsx (タブ追跡)

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active && tab.windowId === currentWindowId) {
    // TabBar 更新 (常に)
    uiStore.setTab({ tabId: tab.id, url: tab.url, title: tab.title });

    // ストリーミング中のみ navigation メッセージを挿入
    if (useStore.getState().isStreaming) {
      chatStore.addNavigationMessage({ url: tab.url!, title: tab.title || "" });
      // agent-loop 側で次の streamText 呼出し時に messages に含まれる
    }
  }
});
```

agent-loop が messages を構築する際、ChatSlice にある navigation メッセージを変換:

```typescript
function buildMessagesForAPI(session: Session, chatMessages: ChatMessage[]): AIMessage[] {
  // ...
  for (const chatMsg of chatMessages) {
    if (chatMsg.role === "navigation") {
      messages.push(convertNavigationForAPI(chatMsg));
    } else {
      messages.push(convertChatMessageForAPI(chatMsg));
    }
  }
}
```

## ツール実行フロー

### 通常のツール実行

```
AIレスポンスに tool_calls が含まれる
    ↓
chatStore.addToolCall() で ToolCallBlock を追加
    ↓
各 tool_call を順次実行
    ↓
chatStore.updateToolCallResult() で結果を設定
    ↓
messages に tool_result を追加
    ↓
次の streamText 呼び出し
```

### skill ツール実行時の特別処理

```
skill({ action: 'create', data: skill }) が呼ばれる
    ↓
SkillRegistry.register(skill) で即座に登録
    ↓
ストレージに永続化
    ↓
同じページを開いている場合、次のターンから使用可能
    ↓
（オプション）即座に SkillDetectionMessage を挿入
```

## エラーハンドリング

### ツールエラー

```typescript
// agent-loop.ts 内
try {
  const result = await executeTool(toolCall, browser, artifactStorage);
  messages.push(buildToolResultMessage(toolCall.id, result));
} catch (error) {
  const toolError: ToolError = {
    code: "tool_execution_error",
    message: error instanceof Error ? error.message : String(error),
  };
  messages.push(buildToolErrorMessage(toolCall.id, toolError));
}
```

### スキル関連エラー

| エラー                   | 原因                                    | 対応                        |
| ------------------------ | --------------------------------------- | --------------------------- |
| `skill_not_found`        | 存在しないスキルを取得/更新しようとした | エラーメッセージをAIに返す  |
| `skill_validation_error` | create時のバリデーション失敗            | エラー詳細を返す            |
| `skill_duplicate_id`     | 同じIDのスキルが既に存在                | 更新を促す                  |
| `skill_execution_error`  | extractor.codeの実行エラー              | sandbox内でキャッチして返す |

## ストリーミング中の特殊処理

### タブ変更検出時

```typescript
// ストリーミング中にタブが変更された場合
if (isStreaming && tabChanged) {
  // 1. 現在のストリーミングを中断
  abortController.abort();

  // 2. NavigationMessage を追加
  chatStore.addNavigationMessage({ url: newUrl, title: newTitle });

  // 3. スキルを再検出
  const newSkills = skillRegistry.findMatchingSkills(newUrl);

  // 4. messages を再構築（新しいスキル情報を含む）
  messages = buildMessagesForAPI(session, chatMessages, newUrl, skillRegistry);

  // 5. ストリーミングを再開
  await streamText({ messages, ... });
}
```

### ユーザー中断時

```typescript
// ユーザーがストリーミングを中断
abortController.abort();

// ToolCall が途中だった場合
if (currentToolCall) {
  // 実行中のツールをキャンセル
  await cancelToolExecution(currentToolCall.id);

  // ToolCallBlock をエラー状態に更新
  chatStore.updateToolCallResult(currentToolCall.id, {
    status: "cancelled",
    result: null,
    error: { code: "user_cancelled", message: "ユーザーが中断しました" },
  });
}
```

## パフォーマンス考慮

### メッセージ構築の最適化

```typescript
// 毎ターン全メッセージを構築するのは非効率
// → 差分更新を検討

let lastMessagesHash = "";

function shouldRebuildMessages(currentHash: string): boolean {
  if (currentHash !== lastMessagesHash) {
    lastMessagesHash = currentHash;
    return true;
  }
  return false;
}
```

### スキル検出のキャッシュ

```typescript
// URLが変わっていなければスキル検出をスキップ
let cachedUrl = "";
let cachedSkills: SkillMatch[] = [];

function getMatchingSkills(url: string, registry: SkillRegistry): SkillMatch[] {
  if (url === cachedUrl) {
    return cachedSkills;
  }
  cachedUrl = url;
  cachedSkills = registry.findMatchingSkills(url);
  return cachedSkills;
}
```

## テスト方針

### agent-loop のテスト

```typescript
// __tests__/agent-loop.test.ts

describe("Agent Loop", () => {
  test("skill detection message is included in API messages", async () => {
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(youtubeSkill);

    const messages = buildMessagesForAPI(
      session,
      chatMessages,
      "https://youtube.com/watch?v=xxx",
      skillRegistry,
    );

    const skillMessage = messages.find(
      (m) => m.role === "system" && m.content.includes("Available skills"),
    );

    expect(skillMessage).toBeDefined();
  });

  test("navigation message is converted to user message", async () => {
    const navMessage: NavigationChatMessage = {
      role: "navigation",
      url: "https://example.com",
      title: "Example",
    };

    const apiMessage = convertNavigationForAPI(navMessage);

    expect(apiMessage.role).toBe("user");
    expect(apiMessage.content[0].text).toContain("ページ遷移");
  });
});
```

## 関連ドキュメント

- [機能仕様](./feature-spec.md) - F-10 NavigationMessage, F-xx Skillシステム
- [システムプロンプト](./system-prompt.md) - スキル使用のプロンプト指示
- [スキルツール詳細](./skill-tool.md) - スキルシステムの詳細設計
- [エラーハンドリング](../architecture/error-handling.md) - ToolError の設計
- [状態管理](../architecture/state-management.md) - ChatSlice の設計
