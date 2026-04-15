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

# MCP Server を起動
mcp:
    npx tsx mcp-server/cli.ts

# ローカルにインストール (npm link)
install: build
    npm link
    @echo ""
    @echo "✅ sitesurf installed"
    @echo "   MCP登録: sitesurf mcp add"
    @echo "   Skills登録: sitesurf skills add"

# アンインストール
uninstall:
    npm unlink -g sitesurf 2>/dev/null || true
    @echo "✅ sitesurf uninstalled"

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
