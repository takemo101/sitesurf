# manifest.json パーミッション設計

## 概要

Chrome拡張の manifest.json に宣言するパーミッションとその根拠を定める。

## パーミッション一覧

### permissions (ユーザーの明示的許可不要)

| パーミッション  | 使用箇所                                                                                   | 根拠                                                                  |
| --------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `storage`       | `adapters/storage/chrome-storage.ts`                                                       | 設定・テーマの永続化 (`chrome.storage.local`)                         |
| `scripting`     | `background/handlers/*.ts`                                                                 | `chrome.scripting.executeScript` でページにJS注入                     |
| `sidePanel`     | `background/index.ts`                                                                      | `chrome.sidePanel.open()` でサイドパネル表示                          |
| `webNavigation` | `background/handlers/navigation.ts`                                                        | `chrome.webNavigation.onDOMContentLoaded` でナビゲーション完了検知    |
| `tabs`          | タブ追跡、OAuth、要素ピッカー                                                              | `chrome.tabs.query/get/create/update/onActivated/onUpdated/onRemoved` |
| `userScripts`   | `features/tools/providers/browser-js-provider.ts`                                          | `chrome.userScripts.execute` でREPLサンドボックス実行                 |
| `notifications` | 通知機能                                                                                   | ユーザーへの通知表示                                                  |
| `debugger`      | `background/handlers/native-input.ts`, `features/tools/providers/native-input-provider.ts` | ネイティブ入力イベント (nativeClick, nativeType)                      |
| `downloads`     | ファイルダウンロード機能                                                                   | ファイルのダウンロードサポート                                        |
| `offscreen`     | `background/handlers/bg-fetch.ts`                                                          | bg_fetch の readability 処理で DOMParser + Readability を実行するため |

### host_permissions

```json
"host_permissions": ["<all_urls>"]
```

全URLへのスクリプト注入が必要。理由:

- `chrome.scripting.executeScript` はホストパーミッションが必要
- ユーザーがどのサイトで操作するか事前に限定できない

### commands

```json
"commands": {
  "toggle-sidepanel": {
    "suggested_key": {
      "default": "Ctrl+Shift+E",
      "mac": "Command+Shift+E"
    },
    "description": "サイドパネルの切替"
  }
}
```

## content_security_policy

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://* http://localhost:* http://127.0.0.1:*",
  "sandbox": "sandbox allow-scripts; script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'self'"
}
```

- `extension_pages`: 拡張ページ (sidepanel.html) ではバンドル済みスクリプトのみ許可。HTTPS/ローカルHTTP接続を許可（各種AIプロバイダーAPI・ローカルLLM向け）。
- `sandbox`: `sandbox.html` でのREPL実行のため `'unsafe-inline'` と `'unsafe-eval'` を許可。

## sandbox

```json
"sandbox": { "pages": ["sandbox.html"] }
```

`sandbox.html` はREPLサンドボックス実行に使用する。`chrome.userScripts.execute` と連携してページコンテキスト外でJSを安全に実行する。

## chrome.storage.session の使用

セッションロック管理で `chrome.storage.session` を使用する。
このAPIは `storage` パーミッションに含まれる (追加パーミッション不要)。

ただし `chrome.storage.session` には以下の制約がある:

- Service Worker のセッション単位で保持 (ブラウザ再起動でクリア)
- デフォルトクォータ: 10MB (ロックデータは数KB なので十分)

## 完全な manifest.json

```json
{
  "manifest_version": 3,
  "name": "SiteSurf",
  "description": "AIと一緒にWebページを操作するChrome拡張",
  "version": "0.1.0",

  "action": {
    "default_title": "SiteSurfを開く",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "side_panel": {
    "default_path": "sidepanel/index.html"
  },

  "permissions": [
    "storage",
    "scripting",
    "sidePanel",
    "webNavigation",
    "tabs",
    "userScripts",
    "alarms",
    "notifications",
    "debugger",
    "downloads",
    "offscreen"
  ],

  "host_permissions": ["<all_urls>"],

  "commands": {
    "toggle-sidepanel": {
      "suggested_key": {
        "default": "Ctrl+Shift+E",
        "mac": "Command+Shift+E"
      },
      "description": "サイドパネルの切替"
    }
  },

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' ws://localhost:* ws://127.0.0.1:* https://* http://localhost:* http://127.0.0.1:*",
    "sandbox": "sandbox allow-scripts; script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'self'"
  },

  "sandbox": { "pages": ["sandbox.html"] }
}
```

## 関連ドキュメント

- [ツール設計](../architecture/tools.md) - scripting の使用箇所
- [セッション管理](./session-management-detail.md) - chrome.storage.session の使用
