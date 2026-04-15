# Smart Content Extraction 設計ドキュメント（修正案）

## 概要

TandemWebのページ内容取得機能を改善し、トークン消費を削減するための設計（修正案）。

**重要**: 当初案の「`read_page` でAI都度抽出」はアーキテクチャ上不可能と判明したため、責務を分離する設計に修正。

## 背景・課題

### 現在の課題

- `read_page`ツールで`simplifiedDOM`（HTML構造）を返している
- 不要な情報（広告、ナビ、スクリプト等）が含まれる
- トークン数が多く（平均2,500トークン）、コスト効率が悪い

### 目標

- トークン消費を50-70%削減
- 必要な情報のみを抽出
- 既存の互換性を維持
- **決定的な動作**（AI呼び出しを含まない）

## 設計方針（修正版）

### 核心：責務の分離

```
┌─────────────────────────────────────────────────────────────┐
│  従来の誤った設計（破綻）                                      │
│  read_page → AIに抽出コード生成を依頼 → 実行 → 結果返却      │
│  （1ツールで完結しようとしているが、アーキテクチャ上不可能）  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  修正案：責務を分離                                           │
│                                                              │
│  read_page        → 決定的な軽量抽出（title + main content）│
│  repl + browserjs → 必要時のみ精密抽出（AIがコード生成）     │
└─────────────────────────────────────────────────────────────┘
```

### `read_page` の責務（決定的）

1. **軽量な決定的抽出のみ**
   - `document.title`
   - `document.querySelector('main, article, [role="main"]')?.textContent`
   - `h1` 見出し
   - メタ情報（description等）

2. **AI呼び出しは含めない**
   - 同期処理として即座に結果を返す
   - 再入呼び出し（LLM→read_page→LLM）を防ぐ

3. **フォールバックを提供**
   - 取得内容が不十分な場合、`repl`ツールへの誘導メッセージを含める

### `repl + browserjs()` の責務（AI主導）

1. **精密抽出**
   - AIが必要に応じてカスタムコードを生成
   - `browserjs(() => { /* AI生成の抽出コード */ })`

2. **Skillsサポート**
   - よく使うサイト向けのテンプレートを提供
   - AIが適切なSkillを選択して使用

## アーキテクチャ

### 1. `read_page`ツール（軽量化版）

```typescript
// 変更前（重い）
export const readPageToolDef = {
  name: "read_page",
  // simplifiedDOM（HTMLタグ付き）を返す
  // 平均2,500トークン
};

// 変更後（軽量）
export const readPageToolDef = {
  name: "read_page",
  description: `ページの主要コンテンツを軽量に抽出する。
取得できる情報: タイトル、本文（プレーンテキスト）、メタ情報。
より詳細な抽出が必要な場合は、replツールでbrowserjs()を使用してください。`,
  // プレーンテキストのみ返す
  // 目標: 平均500-800トークン
};
```

**抽出ロジック**:

```typescript
function extractPageContentLightweight(): PageContent {
  const title = document.title;

  // 本文候補を優先順位で探す
  const mainSelectors = [
    "article",
    "main",
    '[role="main"]',
    ".content",
    "#content",
    ".post",
    ".entry",
  ];

  let mainText = "";
  for (const selector of mainSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      mainText = el.textContent?.substring(0, 5000) || "";
      break;
    }
  }

  // フォールバック: body全体
  if (!mainText) {
    mainText = document.body?.textContent?.substring(0, 5000) || "";
  }

  // h1見出し
  const h1 = document.querySelector("h1")?.textContent || "";

  // メタdescription
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

  return {
    url: location.href,
    title,
    text: `${h1}\n\n${mainText}`.substring(0, 6000),
    simplifiedDom: description, // 互換性のため
  };
}
```

### 2. Skillsシステム（`repl`用テンプレート）

```typescript
// src/features/tools/skills/types.ts
interface Skill {
  id: string;
  name: string;
  description: string;
  matchers: {
    hosts: string[]; // 例: ["youtube.com", "youtu.be"]
    paths?: string[]; // 例: ["/watch"]
    signals?: string[]; // DOMに存在する必要がある要素
  };
  extractors: SkillExtractor[];
}

interface SkillExtractor {
  id: string;
  name: string;
  description: string;
  selector?: string; // DOMシグナル（この要素が存在したら使用可能）
  code: string; // browserjsに渡すコード
  outputSchema: string; // 出力の説明
}
```

**例: YouTube Skill**:

```typescript
const youtubeSkill: Skill = {
  id: "youtube",
  name: "YouTube",
  description: "YouTube動画ページの情報抽出",
  matchers: {
    hosts: ["youtube.com", "youtu.be"],
    paths: ["/watch"],
    signals: ["ytd-watch-metadata"],
  },
  extractors: [
    {
      id: "videoInfo",
      name: "動画情報",
      description: "タイトル、チャンネル、説明を取得",
      selector: "ytd-watch-metadata",
      code: `
        const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim();
        const channel = document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim();
        const description = document.querySelector('#description-inline-expander')?.textContent?.trim();
        return { title, channel, description };
      `,
      outputSchema: "{ title: string, channel: string, description: string }",
    },
    {
      id: "comments",
      name: "コメント",
      description: "上位10件のコメントを取得",
      selector: "ytd-comments",
      code: `
        return Array.from(document.querySelectorAll('ytd-comment-renderer')).slice(0, 10).map(c => ({
          author: c.querySelector('#author-text')?.textContent?.trim(),
          text: c.querySelector('#content-text')?.textContent?.trim()
        }));
      `,
      outputSchema: "Array<{ author: string, text: string }>",
    },
  ],
};
```

### 3. Skillレジストリと選択

```typescript
// src/features/tools/skills/registry.ts
class SkillRegistry {
  private skills: Map<string, Skill> = [];

  register(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  // URLと現在のDOMから適切なSkillを検出
  findMatchingSkills(url: string, document: Document): SkillMatch[] {
    const hostname = new URL(url).hostname.toLowerCase();

    return Array.from(this.skills.values())
      .filter((skill) => {
        // ホストマッチ（厳密）
        const hostMatch = skill.matchers.hosts.some(
          (pattern) => hostname === pattern || hostname.endsWith("." + pattern),
        );
        if (!hostMatch) return false;

        // パスマッチ（任意）
        if (skill.matchers.paths) {
          const pathname = new URL(url).pathname;
          const pathMatch = skill.matchers.paths.some((pattern) => pathname.startsWith(pattern));
          if (!pathMatch) return false;
        }

        return true;
      })
      .map((skill) => ({
        skill,
        availableExtractors: skill.extractors.filter(
          (ex) => !ex.selector || document.querySelector(ex.selector),
        ),
      }));
  }
}
```

### 4. システムプロンプト（修正案）

```markdown
## ページ内容の読み取り

### パターン1: 軽量な概要取得（推奨: 最初に使用）

`read_page` ツールでページの主要コンテンツを取得：
```

read_page → { title, text, url }

````

### パターン2: 詳細な特定情報の抽出
取得した概要で不十分な場合は、`repl` ツールで `browserjs()` を使用：

```javascript
// 一般的な抽出例
const data = await browserjs(() => {
  return {
    title: document.querySelector('h1')?.textContent,
    items: Array.from(document.querySelectorAll('.item')).map(el => ({
      name: el.querySelector('.name')?.textContent,
      price: el.querySelector('.price')?.textContent
    }))
  };
});
````

### パターン3: Skillsの使用（対応サイトの場合）

特定サイト（YouTube, Amazon等）では、Skillsが提供される場合があります：

```javascript
// YouTubeの例
if (typeof skills !== "undefined" && skills["youtube"]) {
  const code = skills["youtube"].extractors["videoInfo"].code;
  const fn = new Function(`return (${code})`)();
  const info = await browserjs(fn);
}
```

### 推奨ワークフロー

1. **必ず `read_page` で概要を取得**（1ターン目）
2. **概要を分析**し、不足情報を特定
3. **必要に応じて `repl` で追加抽出**（2ターン目以降）
4. **対応サイトではSkillsを活用**

### セレクタのベストプラクティス

- 構造ベース: `id`, `class`, `data-*`, `role`, `aria-label`
- テキスト内容は避ける（言語依存）
- `textContent` を優先（`innerText`より高速）

````

## 実装計画（修正案）

### Phase 1: 最小限の軽量化（1-2日）

**目標**: `read_page` のトークンを50%削減

1. **`read_page` 軽量化実装**
   - simplifiedDOM廃止 → プレーンテキスト抽出
   - メインコンテンツ検出ロジック
   - 既存テストの互換性維持

2. **システムプロンプト更新**
   - 推奨ワークフローの説明
   - `read_page` → `repl` の段階的抽出を促進

3. **効果測定**
   - 5-10サイトで新旧比較
   - 目標: 50%以上削減

### Phase 2: Skillsシステム（2-3日）

**目標**: 主要サイトでの効率化

1. **Skills基盤**
   - 型定義
   - レジストリ
   - マッチングロジック

2. **デフォルトSkills（2-3個）**
   - YouTube
   - Google検索
   - （AmazonはPhase 3で検討）

3. **システムプロンプト更新**
   - Skills使用ガイド

### Phase 3: 拡張と最適化（2-3日）

1. **追加Skills**
   - Amazon
   - GitHub
   - ニュースサイト汎用Skill

2. **エラーハンドリング強化**
   - Skill失敗時のフォールバック
   - 動的サイト対応（waitFor）

3. **最終効果測定**
   - 包括的なトークン削減レポート

## トークン削減効果の見積もり（修正案）

### `read_page` 軽量化のみ（Phase 1）

| シナリオ | 現在 | Phase 1後 | 削減率 |
|---------|------|----------|--------|
| ニュース記事 | 2,500 | 600-800 | 70% |
| YouTube | 3,000 | 400-600 | 80% |
| ECサイト | 4,000 | 800-1,200 | 70% |
| 検索結果 | 2,000 | 500-700 | 70% |

**平均削減率: 70%**

### Skills使用時（Phase 2-3）

| シナリオ | 現在 | Skills使用時 | 削減率 |
|---------|------|-------------|--------|
| YouTube動画情報 | 3,000 | 200-400 | 90% |
| Google検索結果 | 2,000 | 300-500 | 80% |

**平均削減率: 85%**

## 技術的考慮事項

### 互換性維持

```typescript
// simplifiedDomは互換性のため残すが、内容を変更
interface PageContent {
  url: string;
  title: string;
  text: string;        // メインコンテンツ（軽量）
  simplifiedDom: string; // 互換性のため: メタ情報や誘導メッセージ
}
````

### エラーハンドリング

```typescript
// 軽量抽出失敗時のフォールバック
try {
  const content = extractMainContent();
  return { ok: true, value: content };
} catch (e) {
  // 最小限の情報だけ返す
  return {
    ok: true,
    value: {
      url: location.href,
      title: document.title,
      text: "[抽出に失敗しました。replツールでbrowserjs()を使用してください。]",
      simplifiedDom: "",
    },
  };
}
```

### セキュリティ

- `read_page` は決定的なコードのみ実行（ユーザー入力を受けない）
- Skillsコードも決定的（文字列テンプレート）
- 動的コード実行は `repl` ツールに隔離

## 成功基準

- [ ] Phase 1: `read_page` のトークンを50%以上削減
- [ ] Phase 1: 既存の会話履歴が正常に動作
- [ ] Phase 2: YouTube/GoogleでSkillsが動作
- [ ] Phase 2: システムプロンプトの指示に従い、AIが適切にSkillsを使用
- [ ] Phase 3: 3つ以上のSkillsが利用可能

## 参考

- 既存拡張: https://github.com/badlogic/既存拡張
- Readability.js: https://github.com/mozilla/readability
- レビュー指摘: `docs/reviews/2026-04-05-smart-content-extraction-review.md`
