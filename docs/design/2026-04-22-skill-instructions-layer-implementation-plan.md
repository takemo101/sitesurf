# Skill Instructions Layer Implementation Plan

**Goal:** 既存の Skill システムを壊さずに instruction layer を追加し、`instructions-only` / `extractors-only` / `instructions + extractors` をサポートする。

**Architecture:** Skill Markdown を正本に保ったまま、parser / types / validation / prompt 表示に instruction layer を追加する。runtime の executable extractor 注入モデルは維持し、`Skill match` と `instruction activation` を分離する。

**Tech Stack:** TypeScript, React, Zustand, Vitest, GitHub CLI

---

## 実装の前提

- 詳細設計は `docs/design/skill-instructions-layer.md`
- 現行仕様の基盤は `docs/design/skill-system.md`, `docs/design/system-prompt.md`
- runtime 実行モデル (`browserjs` で page context に extractor 注入) はこのフェーズでは変更しない

## 進め方

AI が実装しやすいよう、以下の 5 issue に分割する。
各 issue は **単独でレビュー可能**、かつ **依存関係が明確** な粒度にする。

---

## Issue 1: Skill 型・parser・renderer の instruction layer 対応

**目的**
- `Skill` に instruction layer を表現できるようにする
- 新形式 Markdown と旧形式 fallback を両立する
- renderer / persistence の round-trip 基盤を作る

**主な変更対象**
- `src/shared/skill-types.ts`
- `src/shared/skill-parser.ts`
- `src/shared/skill-markdown.ts`
- `src/features/settings/skills-persistence.ts`
- `src/features/tools/skills/skill-loader.ts`
- 関連テスト一式

**完了条件**
- `instructionsMarkdown?` を持つ `Skill` 型が定義される
- `# Instructions` / `# Extractors` を認識する parser が実装される
- 旧形式 skill markdown は無修正で parse できる
- instruction-only / extractors-only / mixed の 3 形態を renderer が扱える
- round-trip テストが追加される

**依存関係**
- なし（最初に着手）

---

## Issue 2: Skill validation と safety guardrail の更新

**目的**
- instruction-only skill を正規に許可する
- instruction / extractor のどちらも空の skill を reject する
- extractor に `bgFetch(` が書かれているケースを warning として検出する

**主な変更対象**
- `src/shared/skill-validation.ts`
- `src/features/settings/SkillsEditor.tsx`
- `src/features/tools/skill.ts`
- 関連テスト

**完了条件**
- validation が新ルールに更新される
- draft validation / normal validation の両方で挙動が揃う
- `bgFetch(` warning が Skills Editor で確認できる
- 旧形式 skill の validation は従来どおり通る

**依存関係**
- Issue 1

---

## Issue 3: system prompt への instruction summary 統合

**目的**
- executable extractor metadata とは別に、instruction summary を AI に提示する
- instruction 全文の常時注入を避け、`Skill match ≠ instruction activation` の基礎を作る

**主な変更対象**
- `src/features/ai/system-prompt-v2.ts`
- 必要に応じて `src/shared/skill-types.ts` の補助型
- prompt テスト群

**完了条件**
- extractor-only skill は現行に近い prompt 表示を維持する
- instruction を持つ skill は short guidance を表示できる
- 初期実装では passive / contextual の 2 段階で出し分ける
- instruction 全文は常時出さない
- extractor code は prompt に入らない

**依存関係**
- Issue 1

---

## Issue 4: instruction activation の path / extractor 連動ルール実装

**目的**
- host match だけで GitHub 系 instruction が過剰発火しないようにする
- instruction activation を Skill match から分離する

**主な変更対象**
- `src/shared/skill-types.ts`
- `src/shared/skill-parser.ts`（必要なら instruction block parse を追加）
- `src/shared/skill-registry.ts` または prompt 用 helper
- `src/features/ai/system-prompt-v2.ts`
- 関連テスト

**完了条件**
- path 条件や extractor 関連による contextual activation が入る
- `github.com` にいるだけでは repo-analysis guidance が強く出ない
- 関連 extractor が使われるときだけ caution が追加される
- 無関係タスクでの過剰 guidance を防ぐテストがある

**依存関係**
- Issue 3

---

## Issue 5: Skills Editor / built-in skills / docs の対応

**目的**
- instruction layer を人間が編集・確認しやすくする
- built-in skill のフォーマット更新とドキュメント整備を行う

**主な変更対象**
- `src/features/settings/SkillsEditor.tsx`
- `public/skills/*.md`（必要なもの）
- `docs/design/skill-system.md`
- `docs/design/system-prompt.md`
- `docs/design/README.md`
- 必要なテスト

**完了条件**
- Skills Editor で instruction を含む markdown を編集・プレビューできる
- GitHub 系など誤解の強い built-in skill が新方針に沿って更新される
- 設計ドキュメントが現行実装に追随する
- 既存 built-in skill の読み込みテストが落ちない

**依存関係**
- Issue 1〜4 の完了後が望ましい

---

## 実装順序

1. Issue 1 — データモデルと parser の土台
2. Issue 2 — validation / safety guardrail
3. Issue 3 — prompt 統合
4. Issue 4 — activation の精緻化
5. Issue 5 — editor / built-in / docs

---

## レビュー観点

- 既存 skill の後方互換性が本当に維持されているか
- prompt に instruction を入れすぎていないか
- GitHub のような広い host で過剰 guidance が出ないか
- `bgFetch()` と extractor 実行モデルの誤解を助長しないか
- Settings / persistence / built-in skill loader が新形式を安全に扱えるか

---

## 実装メモ

- 初期実装では `instructionsMarkdown` のみを正本にし、`instructionBlocks` の完全構造化は後続 issue で行ってもよい
- prompt activation の最初の段階は「軽く出す」ことを優先し、強く効かせすぎない
- `github-repo-analyzer-v2` のような既存 skill は Issue 5 で新方針に合わせて移行または縮退させる
