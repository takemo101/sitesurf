# AI SDK Documentation

> **Source:** https://ai-sdk.dev  
> **Crawled:** 2026-04-04  
> **Pages:** 101 → Organized into 8 categories

## 概要

Vercel AI SDKは、React、Next.js、Vue、Svelte、Node.js、およびその他のフレームワークを使用してAI駆動のアプリケーションとエージェントを構築するためのTypeScript ツールキットです。モデルの推論、構造化データの生成、ツール呼び出し、ストリーミング、UI レイヤーサポートなど、包括的なAI機能を提供します。

## ドキュメント構成

### 📚 基礎 (Foundations)

AIの基本概念とAI SDKの中核的な概念を学びます。

- **pages:** `foundations-overview.md`, `providers-and-models.md`, `prompts.md`, `tools.md`, `streaming.md`, `provider-options.md`
- **主要トピック:** プロバイダーの選択、モデルの理解、プロンプト構造、ツール呼び出し、ストリーミングの利点

### 🚀 はじめに (Getting Started)

異なるプラットフォームやフレームワークでのセットアップガイド。

- **pages:** `choosing-a-provider.md`, `navigating-the-library.md`, `nextjs-app-router.md`, `nextjs-pages-router.md`, `svelte.md`, `vue-nuxt.md`, `nodejs.md`, `expo.md`, `tanstack-start.md`, `coding-agents.md`
- **主要トピック:** プロバイダー設定、フレームワーク統合、最初のアプリケーション構築

### 🤖 エージェント (Agents)

AI エージェントの構築と管理。

- **pages:** `agents-overview.md`, `building-agents.md`, `workflow-patterns.md`, `loop-control.md`, `configuring-call-options.md`, `memory.md`, `subagents.md`
- **主要トピック:** エージェントアーキテクチャ、ワークフロー、ループ制御、メモリ管理、サブエージェント

### 💻 AI SDK Core

テキスト生成、構造化データ、ツール呼び出し、メディア処理など、主要な機能。

- **pages:** `core-overview.md`, `generating-text.md`, `generating-structured-data.md`, `tool-calling.md`, `mcp-tools.md`, `prompt-engineering.md`, `settings.md`, `embeddings.md`, `reranking.md`, `image-generation.md`, `transcription.md`, `speech.md`, `video-generation.md`, `middleware.md`, `provider-management.md`, `error-handling.md`, `testing.md`, `telemetry.md`, `devtools.md`, `event-callbacks.md`
- **主要トピック:** API リファレンス、各機能の詳細な使用法

### 🎨 AI SDK UI

フロントエンドコンポーネントとUIレイヤー。

- **pages:** `ui-overview.md`, `chatbot.md`, `chatbot-message-persistence.md`, `chatbot-resume-streams.md`, `chatbot-tool-usage.md`, `generative-user-interfaces.md`, `completion.md`, `object-generation.md`, `streaming-custom-data.md`, `error-handling.md`, `transport.md`, `reading-uimessage-streams.md`, `message-metadata.md`, `stream-protocols.md`
- **主要トピック:** useChat フック、Generative UI、ストリーミングデータ、エラーハンドリング

### 🔧 高度な使用法 (Advanced)

高度なパターン、マイグレーション、トラブルシューティング。

- **pages:** `advanced-patterns.md`, `migration-guides.md`, `troubleshooting.md`
- **主要トピック:** 複雑なシナリオ、バージョンアップグレード、一般的な問題の解決

### 📖 リファレンス (Reference)

API とエラーのリファレンス文書。

- **pages:** `core-reference.md`, `ui-reference.md`
- **主要トピック:** 完全なAPIドキュメント、型定義、エラーコード

### 🔌 プロバイダー (Providers)

21以上のAIプロバイダーの統合ガイド。

- **pages:** `providers-overview.md`, `openai.md`, `anthropic.md`, `google-generative-ai.md`, `xai-grok.md`, `azure-openai.md`, `amazon-bedrock.md`, `groq.md`, `fal.md`, `deepinfra.md`, `google-vertex-ai.md`, `mistral.md`, `togetherai.md`, `cohere.md`, `fireworks.md`, `deepseek.md`, `cerebras.md`, `perplexity.md`, `luma.md`, `baseten.md`
- **主要トピック:** 各プロバイダーの設定、認証、モデルオプション

## 使用法

このドキュメントセットを効果的に使用するには：

1. **基礎から始める:** 初めての場合は `foundations/` ディレクトリから開始
2. **フレームワークを選択:** `getting-started/` で使用するプラットフォームを選択
3. **機能を探索:** `core/` でテキスト生成、ツール呼び出しなどのコア機能を学習
4. **UIを統合:** `ui/` で UI レイヤーの統合方法を確認
5. **プロバイダーを設定:** `providers/` で必要なAIプロバイダーを統合

## キーコンセプト

- **モデルプロバイダー:** OpenAI、Anthropic、Google など複数のプロバイダーをサポート
- **ストリーミング:** リアルタイムデータのストリーミング対応
- **ツール呼び出し:** LLM がカスタム関数を呼び出せる機能
- **構造化データ:** JSON スキーマベースの出力生成
- **エージェント:** 自動的にタスクを実行できるAI エージェント
- **Generative UI:** AIが動的にUIを生成

## ドキュメント統計

| カテゴリ        | ページ数 |
| --------------- | -------- |
| Foundations     | 7        |
| Getting Started | 11       |
| Agents          | 8        |
| AI SDK Core     | 22       |
| AI SDK UI       | 16       |
| Advanced        | 3        |
| Reference       | 2        |
| Providers       | 21       |
| Index           | 9        |
| **合計**        | **101**  |

## クイックリンク

- **テキスト生成:** `core/generating-text.md`
- **構造化データ:** `core/generating-structured-data.md`
- **ツール呼び出し:** `core/tool-calling.md`
- **チャットUI:** `ui/chatbot.md`
- **エージェント構築:** `agents/building-agents.md`
- **Next.js 統合:** `getting-started/nextjs-app-router.md`
- **OpenAI 設定:** `providers/openai.md`

---

**最後に更新:** 2026-04-04  
**ドキュメントバージョン:** AI SDK v6.x
