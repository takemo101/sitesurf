# HTML Sandbox 実装方式

## 概要

Sitesurf で HTML アーティファクトのプレビューを表示する際に採用している方式。

## 採用方式: SandboxedIframe with Runtime Message Bridge

既存拡張 で採用されている方式を参考に、Chrome 拡張機能のコンテキストに適応させた実装。

## 実装詳細

| 項目                  | 実装内容                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **iframe の読み込み** | `chrome.runtime.getURL("sandbox.html")` を `src` に設定                                                                                   |
| **HTML の注入方法**   | `postMessage` で `document.write()` を実行                                                                                                |
| **CSP 回避原理**      | sandbox.html は `chrome-extension://` オリジンで読み込まれるため、拡張機能ファイルの CSP ポリシー（インラインスクリプト許可）が適用される |
| **コンソール転送**    | sandbox 内で `console.log` などを上書きし、`postMessage` で親ウィンドウに送信                                                             |
| **スクリプト実行**    | `document.write()` された HTML 内の `<script>` タグは通常通り実行される                                                                   |

## コード例

### React コンポーネント側

```tsx
function HtmlSandbox({ html, name }: { html: string; name: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState([]);

  // 拡張機能内の sandbox.html を読み込み
  const sandboxUrl = chrome.runtime.getURL("sandbox.html");

  // メッセージ受信（コンソール転送など）
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;

      if (e.data?.type === "sandbox-ready") {
        setIsReady(true);
      } else if (e.data?.type === "console") {
        setLogs((prev) => [
          ...prev,
          {
            type: e.data.method,
            text: e.data.text,
          },
        ]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // HTML を sandbox に送信
  useEffect(() => {
    if (!isReady || !iframeRef.current) return;

    const renderScript = `
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
      
      // コンソール転送設定
      const orig = { 
        log: console.log, 
        error: console.error, 
        warn: console.warn, 
        info: console.info 
      };
      function send(method, args) {
        try {
          const text = args.map(a => 
            typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
          ).join(' ');
          window.parent.postMessage({ 
            type: 'console', 
            method, 
            text 
          }, '*');
        } catch (e) {}
      }
      console.log = (...a) => { send('log', a); orig.log(...a); };
      console.error = (...a) => { send('error', a); orig.error(...a); };
      console.warn = (...a) => { send('warn', a); orig.warn(...a); };
      console.info = (...a) => { send('info', a); orig.info(...a); };
      window.onerror = (msg, url, line) => { 
        send('error', [msg + ' (line ' + line + ')']); 
        return false; 
      };
    `;

    iframeRef.current.contentWindow?.postMessage({ type: "exec", code: renderScript }, "*");
  }, [isReady, html]);

  return (
    <iframe
      ref={iframeRef}
      src={sandboxUrl}
      sandbox="allow-scripts allow-modals"
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
}
```

### sandbox.html

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <script>
      // 親ウィンドウからのメッセージを待機
      window.addEventListener("message", async (event) => {
        if (event.source !== window.parent) return;

        if (event.data.type === "exec") {
          try {
            const fn = new Function(event.data.code);
            await fn();
            window.parent.postMessage(
              {
                type: "exec-result",
                ok: true,
              },
              "*",
            );
          } catch (e) {
            window.parent.postMessage(
              {
                type: "exec-result",
                ok: false,
                error: e.message,
              },
              "*",
            );
          }
        }
      });

      // 準備完了を通知
      window.parent.postMessage({ type: "sandbox-ready" }, "*");
    </script>
  </body>
</html>
```

## 方式比較

| 方式                | 説明                                                           | CSP 制限                                                                                            | スクリプト実行 | 評価      |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------- | --------- |
| **Blob URL**        | `URL.createObjectURL()` で生成した URL を iframe の src に設定 | 親フレームの CSP を継承するためインラインスクリプトがブロックされる                                 | ❌ 不可        | ❌ 不採用 |
| **srcDoc**          | `srcdoc` 属性に HTML を直接記述                                | 親フレームの CSP を継承するためインラインスクリプトがブロックされる                                 | ❌ 不可        | ❌ 不採用 |
| **SandboxedIframe** | 拡張機能の `sandbox.html` を読み込み、`postMessage` で通信     | `chrome-extension://` オリジンのため独自の CSP ポリシーが適用され、インラインスクリプトが許可される | ✅ 可能        | ✅ 採用   |

## なぜこの方式か

1. **CSP 回避**: `chrome-extension://` オリジンのファイルは Chrome 拡張機能のデフォルト CSP ポリシー（`'unsafe-eval'` やインラインスクリプト許可）が適用される

2. **セキュリティ**: `sandbox="allow-scripts"` 属性により、iframe 内のスクリプトは実行されるが、親フレームへの DOM アクセスやナビゲーションは制限される

3. **コンソール連携**: `postMessage` で双方向通信を実現し、sandbox 内のコンソール出力を親ウィンドウで表示可能

4. **ファイル切り替え対応**: `key` プロパティを変更して iframe を再マウントすることで、異なる HTML ファイル間の切り替えに対応

## 注意点・制限事項

### CSP エラーの発生条件

- `sandbox.html` を読み込んだ後、`document.write()` せずにインラインスクリプトを実行しようとすると CSP エラーが発生する
- 必ず `document.write()` で HTML を書き込んでからスクリプトを実行する

### ファイル切り替え時の挙動

- HTML ファイルを切り替える際は、iframe を再マウント（`key` を変更）して sandbox-ready からやり直す必要がある
- 単に `postMessage` で新しい HTML を送信しても、既存の document 状態が残っているため意図しない動作になることがある

### 制限事項

- `document.write()` は同期的に実行されるため、大きな HTML の場合はレンダリングブロックが発生する可能性がある
- 外部スクリプト（`src` 属性付き `<script>`）は通常通り読み込まれるが、読み込み完了を待たずに `document.close()` するとスクリプトが実行されない場合がある

## 関連ファイル

- `src/features/artifacts/ArtifactPreview.tsx` - React コンポーネント実装
- `public/sandbox.html` - sandbox iframe 用 HTML
- `src/features/tools/definitions/artifacts-tool.ts` - artifacts ツール定義

## 参考

- [既存拡張 実装](https://github.com/badlogic/既存拡張) - 参考にしたオリジナルの実装
- [Chrome Extension CSP](https://developer.chrome.com/docs/extensions/mv3/content_security_policy/) - Chrome 拡張機能の CSP ドキュメント
