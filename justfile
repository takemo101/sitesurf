set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just --list

# 依存関係をインストール
deps:
    pnpm install

# Chrome拡張をビルド
build: deps
    vp build

# 開発モード (Chrome拡張 watch ビルド)
dev:
    vp build --watch

# モデル一覧を更新
generate-models:
    npx tsx scripts/generate-models.ts

# チェック (format + lint + 型チェック)
check:
    vp check

# テスト
test *args:
    vp test {{ args }}

# ビルド + チェック + テスト
ci: build check test
