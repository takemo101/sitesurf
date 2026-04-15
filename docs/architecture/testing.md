# テスト戦略

## 設計方針

**Ports & Adapters の最大の利点であるテスタビリティを活かし、
AdapterをモックしてChrome API やAI APIなしでロジックをテストする。**

## テストファイルの配置

すべてのテストファイルは `__tests__/` ディレクトリ内に配置する (ソースファイルと同階層への配置は行わない)。

```
src/
├── features/
│   └── settings/
│       ├── persistence.ts
│       └── __tests__/
│           └── persistence.test.ts   ← feature 内の __tests__/ に配置
│
└── adapters/
    └── chrome/
        └── __tests__/
            └── chrome-browser-executor.test.ts

__tests__/                            ← ルートの __tests__/ (orchestration など)
├── mocks/
├── orchestration/
└── adapters/
```

## テストレベル

### Level 1: ユニットテスト (最優先)

Port のモック実装を使い、各モジュールを単体テストする。

| テスト対象                         | モック対象                  | テスト内容                                                 |
| ---------------------------------- | --------------------------- | ---------------------------------------------------------- |
| `orchestration/agent-loop.ts`      | AIProvider, BrowserExecutor | ストリーミング処理、ツール呼出しループ、エラーハンドリング |
| `features/tools/*.ts`              | BrowserExecutor             | ツール定義のパラメータ変換、結果変換                       |
| `features/settings/persistence.ts` | StoragePort                 | 設定の保存・読込                                           |
| `adapters/ai/provider-factory.ts`  | (なし)                      | ProviderId に応じた正しいプロバイダー生成                  |
| `shared/errors.ts`                 | (なし)                      | Result型ヘルパーの動作                                     |

```typescript
// __tests__/orchestration/agent-loop.test.ts
import { MockAIProvider, MockBrowserExecutor } from "../mocks";

test("ツール呼出し後にAIが応答を継続する", async () => {
  const ai = new MockAIProvider([
    // 1回目: ツール呼出し (tool-input-start/delta でバッファリング)
    { type: "tool-input-start", id: "1", name: "read_page" },
    { type: "tool-input-delta", id: "1", delta: "{}" },
    { type: "finish" },
    // 2回目: テキスト応答
    { type: "text-delta", text: "ページの内容は..." },
    { type: "finish" },
  ]);
  const browser = new MockBrowserExecutor();
  browser.mockReadPage({
    url: "https://example.com",
    title: "Example",
    text: "Hello",
    simplifiedDOM: "",
  });

  const result = await runAgentLoop(ai, browser, tools, messages);
  expect(result.messages).toHaveLength(2); // ツール結果 + テキスト応答
});
```

エージェントループは自己管理の while ループなので、マルチターンのモックに `scenarios` の配列を使う必要はなくなった。
イベント列をフラットに渡し、`tool-input-start/tool-input-delta` のバッファリングと実行を含めてテストする。

### Level 2: 統合テスト

feature + orchestration を組み合わせたテスト。Adapter はモック。

| テスト対象                        | テスト内容                                       |
| --------------------------------- | ------------------------------------------------ |
| チャット → AI → ツール → チャット | ユーザー入力から応答表示までのE2Eフロー (UIなし) |
| 設定保存 → 読込                   | 永続化の往復                                     |
| OAuth → 設定反映                  | 認証完了後にプロバイダーが使えるか               |

### Level 3: E2Eテスト (将来)

Chrome拡張として実際にロードし、Puppeteer/Playwright でサイドパネルを操作する。
v0.1 では対象外。

## モック実装

テスト用のモックは `__tests__/mocks/` に配置する。

```
__tests__/
├── mocks/
│   ├── mock-ai-provider.ts       # AIProvider のモック (イベント列をシナリオ指定)
│   ├── mock-browser-executor.ts  # BrowserExecutor のモック (メソッドごとに戻り値指定)
│   ├── mock-auth-provider.ts     # AuthProvider のモック
│   └── in-memory-storage.ts      # StoragePort のインメモリ実装 (adapters/storage から再export)
│
├── orchestration/
│   └── agent-loop.test.ts
├── features/
│   ├── tools/
│   │   └── read-page.test.ts
│   └── settings/
│       └── persistence.test.ts
└── adapters/
    └── ai/
        └── provider-factory.test.ts
```

### MockAIProvider の設計

```typescript
export class MockAIProvider implements AIProvider {
  private scenarios: StreamEvent[][];
  private callIndex = 0;

  constructor(scenarios: StreamEvent[][]) {
    // scenarios[0] = 1回目のstreamText呼出しで返すイベント列
    // scenarios[1] = 2回目 (ツール結果後のリトライ)
    this.scenarios = scenarios;
  }

  async *streamText(_params: StreamTextParams): AsyncIterable<StreamEvent> {
    const events = this.scenarios[this.callIndex++] ?? [];
    for (const event of events) {
      yield event;
    }
  }
}
```

### MockBrowserExecutor の設計

```typescript
export class MockBrowserExecutor implements BrowserExecutor {
  private pageContent: PageContent = { url: "", title: "", text: "", simplifiedDOM: "" };
  private scriptResults: Result<ScriptResult, ToolError>[] = [];

  mockReadPage(content: PageContent) {
    this.pageContent = content;
  }
  mockScriptResult(result: Result<ScriptResult, ToolError>) {
    this.scriptResults.push(result);
  }

  async getActiveTab() {
    return { id: 1, url: "https://example.com", title: "Test" };
  }
  async readPageContent(_tabId: number) {
    return ok(this.pageContent);
  }
  async executeScript(_tabId: number, _code: string) {
    return this.scriptResults.shift() ?? ok({ result: undefined });
  }
  onTabActivated(_callback: (tabId: number) => void) {
    // テスト用のno-op実装
  }
  // ...
}
```

`onTabActivated` メソッドは BrowserExecutor の Port に含まれるため、MockBrowserExecutor にも実装が必要。

## ChromeBrowserExecutor のテスト

`ChromeBrowserExecutor` は `chrome.runtime.sendMessage` 経由ではなく Chrome API を直接呼び出す実装になっている。
そのため、テストでは `chrome.tabs.query`、`chrome.scripting.executeScript` 等を直接モックする:

```typescript
// adapters/chrome/__tests__/chrome-browser-executor.test.ts
vi.stubGlobal("chrome", {
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: "https://example.com", title: "Test" }]),
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([{ result: "ok" }]),
  },
});
```

## テストしないもの

| 対象                        | 理由                                     |
| --------------------------- | ---------------------------------------- |
| `background/handlers/*.ts`  | chrome.scripting の直接呼出し。E2Eで検証 |
| React コンポーネント (v0.1) | ロジックが薄い。Storybook 導入後に検討   |

## テスト実行

```bash
vp test                    # 全テスト実行
vp test --watch            # watchモード
vp test agent-loop         # 特定テスト
```

## 関連ドキュメント

- [概要](./overview.md) - Ports & Adapters 採用の動機
- [パッケージ構成](./package-structure.md) - テストファイルの配置
- [エラーハンドリング](./error-handling.md) - Result型のテスト
