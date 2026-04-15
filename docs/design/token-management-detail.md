# トークン管理 詳細設計

## 概要

本ドキュメントは [AI接続設計](../architecture/ai-connection.md) のトークン管理部分を具体化し、
AuthProvider Port / Adapter の内部設計、トークンライフサイクル、
AIProvider との連携フローを定める。

## AuthProvider Port の完全な型定義

```typescript
// ports/auth-provider.ts

import type { Result } from "@/shared/errors";
import type { AuthError } from "@/shared/errors";

export interface AuthProvider {
  login(callbacks: AuthCallbacks): Promise<Result<AuthCredentials, AuthError>>;
  refresh(credentials: AuthCredentials): Promise<Result<AuthCredentials, AuthError>>;
  isValid(credentials: AuthCredentials): boolean;
}

export interface AuthCallbacks {
  onDeviceCode?: (info: DeviceCodeInfo) => void;
  onProgress?: (status: AuthFlowStatus) => void;
}

export interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type AuthFlowStatus = "starting" | "waiting-for-user" | "exchanging-token" | "complete";

export interface AuthCredentials {
  providerId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  metadata: AuthMetadata;
}

export interface AuthMetadata {
  accountId?: string;
  [key: string]: string | undefined;
}
```

## トークンライフサイクル

```
[未認証] ──login()──→ [有効] ──時間経過──→ [期限切れ]
                        ↑                      │
                        │                      │ refresh()
                        │                      ▼
                        └──── [有効 (更新済)] ←─┘
                                               │ refresh失敗
                                               ▼
                                          [失効] ──再login()──→ [有効]
```

| 現在の状態 | トリガー                     | アクション                                     | 結果                  |
| ---------- | ---------------------------- | ---------------------------------------------- | --------------------- |
| 未認証     | ユーザーがログインボタン押下 | `AuthProvider.login()`                         | 有効 or エラー        |
| 有効       | AI API 呼び出し前            | `AuthProvider.isValid()` → true                | そのまま使用          |
| 期限切れ   | AI API 呼び出し前            | `AuthProvider.isValid()` → false → `refresh()` | 有効 (更新済) or 失効 |
| 失効       | リフレッシュ失敗             | UIにエラー表示 + 再ログイン促す                | 未認証に戻る          |

### 有効期限の判定

```typescript
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

isValid(credentials: AuthCredentials): boolean {
  return Date.now() < credentials.expiresAt - REFRESH_MARGIN_MS;
}
```

## Auth Adapter 実装

### BrowserExecutor Port の拡張 (タブ閉じ検出)

OAuth フローではタブのリダイレクト監視とタブ閉じ検出が必要。
`BrowserExecutor` に `onTabRemoved` を追加する。

```typescript
// ports/browser-executor.ts に追加

export interface BrowserExecutor {
  // ... 既存 ...
  onTabRemoved(callback: (tabId: number) => void): Unsubscribe;
}
```

### OpenAI PKCE Auth (`adapters/auth/openai-auth.ts`)

```typescript
export class OpenAIAuth implements AuthProvider {
  constructor(private readonly browser: BrowserExecutor) {}

  async login(callbacks: AuthCallbacks): Promise<Result<AuthCredentials, AuthError>> {
    callbacks.onProgress?.("starting");
    const { verifier, challenge } = await generatePKCE();
    const state = generateState();
    const url = buildAuthUrl(challenge, state);

    callbacks.onProgress?.("waiting-for-user");

    // リダイレクト監視 + タブ閉じ検出
    let redirectUrl: URL;
    try {
      redirectUrl = await this.waitForRedirect(url.toString());
    } catch {
      return err({ code: "auth_cancelled", message: "認証がキャンセルされました" });
    }

    const code = redirectUrl.searchParams.get("code");
    if (!code) return err({ code: "auth_cancelled", message: "認証コードが取得できませんでした" });
    if (redirectUrl.searchParams.get("state") !== state)
      return err({ code: "auth_cancelled", message: "認証状態が一致しません" });

    callbacks.onProgress?.("exchanging-token");
    try {
      const tokenData = await this.exchangeCode(code, verifier);
      callbacks.onProgress?.("complete");
      return ok(this.toCredentials(tokenData));
    } catch (e: unknown) {
      return err({
        code: "auth_network",
        message: `トークン交換に失敗: ${(e as Error).message}`,
        cause: e,
      });
    }
  }

  async refresh(credentials: AuthCredentials): Promise<Result<AuthCredentials, AuthError>> {
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
          client_id: CLIENT_ID,
        }),
      });
      if (!res.ok)
        return err({ code: "auth_refresh_failed", message: `リフレッシュ失敗 (${res.status})` });
      return ok(this.toCredentials(await res.json()));
    } catch (e: unknown) {
      return err({ code: "auth_network", message: `リフレッシュ中にネットワークエラー`, cause: e });
    }
  }

  isValid(credentials: AuthCredentials): boolean {
    return Date.now() < credentials.expiresAt - REFRESH_MARGIN_MS;
  }

  // --- Private ---

  /**
   * 認証タブを開き、リダイレクトまたはタブ閉じを待つ。
   * タブが閉じられた場合は reject して auth_cancelled にする。
   */
  private async waitForRedirect(authUrl: string): Promise<URL> {
    const tabId = await this.browser.openTab(authUrl);

    return new Promise<URL>((resolve, reject) => {
      let settled = false;

      const unsubUpdated = this.browser.onTabUpdated((id, url) => {
        if (id !== tabId || settled) return;
        try {
          const parsed = new URL(url);
          if (parsed.host === REDIRECT_HOST) {
            settled = true;
            unsubUpdated();
            unsubRemoved();
            resolve(parsed);
          }
        } catch {
          /* invalid URL */
        }
      });

      const unsubRemoved = this.browser.onTabRemoved((id) => {
        if (id !== tabId || settled) return;
        settled = true;
        unsubUpdated();
        unsubRemoved();
        reject(new Error("Auth tab closed by user"));
      });
    });
  }

  private async exchangeCode(code: string, verifier: string): Promise<Record<string, unknown>> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    return res.json();
  }

  private toCredentials(data: Record<string, unknown>): AuthCredentials {
    const accessToken = data.access_token as string;
    return {
      providerId: "openai",
      accessToken,
      refreshToken: data.refresh_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
      metadata: { accountId: extractAccountId(accessToken) },
    };
  }
}

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const REDIRECT_HOST = "localhost:1455";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
```

### Copilot Device Flow Auth (`adapters/auth/copilot-auth.ts`)

GitHub Copilot の個人版 (github.com) とエンタープライズ版 (GHES) の両方に対応する。

#### エンドポイントの構造

```typescript
function getUrls(domain: string) {
  return {
    deviceCodeUrl: `https://${domain}/login/device/code`,
    accessTokenUrl: `https://${domain}/login/oauth/access_token`,
    copilotTokenUrl: `https://api.${domain}/copilot_internal/v2/token`,
  };
}
```

|               | 個人 (github.com)                          | エンタープライズ (GHES)                  |
| ------------- | ------------------------------------------ | ---------------------------------------- |
| Device Flow   | `github.com/login/device/code`             | `{domain}/login/device/code`             |
| Access Token  | `github.com/login/oauth/access_token`      | `{domain}/login/oauth/access_token`      |
| Copilot Token | `api.github.com/copilot_internal/v2/token` | `api.{domain}/copilot_internal/v2/token` |
| Chat API      | トークンの `proxy-ep` から動的解決         | トークンの `proxy-ep` から動的解決       |

#### AuthCredentials の拡張

Copilot の場合、`AuthCredentials.metadata` に `enterpriseDomain` を保存する。
リフレッシュ時にドメインを参照するため。

```typescript
// Copilot の AuthCredentials
{
  providerId: "copilot",
  accessToken: "...",          // Copilot token
  refreshToken: "...",         // GitHub access token
  expiresAt: 1234567890,
  metadata: {
    enterpriseDomain: "github.example.com",  // 個人版の場合は undefined
  },
}
```

#### ドメイン正規化

```typescript
function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname;
  } catch {
    return null;
  }
}
```

ユーザーが `https://github.example.com` や `github.example.com` のどちらを入力しても
`github.example.com` に正規化する。

#### CopilotAuth 実装

```typescript
const GH_CLIENT_ID = atob("SXYxLmI1MDdhMDhjODdlY2ZlOTg=");

export class CopilotAuth implements AuthProvider {
  constructor(private readonly browser: BrowserExecutor) {}

  /**
   * @param enterpriseDomain - GHES のドメイン (空なら github.com)
   *   設定画面の enterpriseDomain 入力欄の値を渡す。
   */
  async login(
    callbacks: AuthCallbacks,
    enterpriseDomain?: string,
  ): Promise<Result<AuthCredentials, AuthError>> {
    callbacks.onProgress?.("starting");

    const domain = enterpriseDomain
      ? normalizeDomain(enterpriseDomain) || "github.com"
      : "github.com";
    const urls = getUrls(domain);

    // (1) Device Code 取得
    const deviceRes = await fetch(urls.deviceCodeUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: GH_CLIENT_ID, scope: "read:user" }),
    });
    if (!deviceRes.ok)
      return err({ code: "auth_network", message: `Device Code の取得に失敗 (${domain})` });
    const device = await deviceRes.json();

    // (2) UI 通知 + ブラウザで開く
    callbacks.onDeviceCode?.({
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      interval: device.interval,
    });
    callbacks.onProgress?.("waiting-for-user");
    this.browser.openTab(device.verification_uri);

    // (3) ポーリング
    const ghToken = await this.pollForToken(
      domain,
      device.device_code,
      device.interval,
      device.expires_in,
    );
    if (!ghToken.ok) return ghToken;

    // (4) Copilot token に交換
    callbacks.onProgress?.("exchanging-token");
    return this.exchangeCopilotToken(ghToken.value, domain);
  }

  async refresh(credentials: AuthCredentials): Promise<Result<AuthCredentials, AuthError>> {
    const domain = credentials.metadata.enterpriseDomain || "github.com";
    return this.exchangeCopilotToken(credentials.refreshToken, domain);
  }

  isValid(credentials: AuthCredentials): boolean {
    return Date.now() < credentials.expiresAt - 5 * 60 * 1000;
  }

  // --- Private ---

  private async pollForToken(
    domain: string,
    deviceCode: string,
    intervalSec: number,
    expiresIn: number,
  ): Promise<Result<string, AuthError>> {
    const urls = getUrls(domain);
    const deadline = Date.now() + expiresIn * 1000;
    let interval = Math.max(1000, intervalSec * 1000);

    while (Date.now() < deadline) {
      await sleep(interval);
      const res = await fetch(urls.accessTokenUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GH_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });
      const data = await res.json();
      if (data.access_token) return ok(data.access_token);
      if (data.error === "slow_down") {
        interval = (data.interval ?? intervalSec + 5) * 1000;
        continue;
      }
      if (data.error === "authorization_pending") continue;
      if (data.error)
        return err({ code: "auth_cancelled", message: `GitHub認証エラー: ${data.error}` });
    }
    return err({ code: "auth_cancelled", message: "認証がタイムアウトしました" });
  }

  private async exchangeCopilotToken(
    ghAccessToken: string,
    domain: string,
  ): Promise<Result<AuthCredentials, AuthError>> {
    const urls = getUrls(domain);
    const res = await fetch(urls.copilotTokenUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${ghAccessToken}`,
        "User-Agent": "GitHubCopilotChat/0.35.0",
        "Editor-Version": "vscode/1.107.0",
        "Copilot-Integration-Id": "vscode-chat",
      },
    });
    if (!res.ok)
      return err({
        code: "auth_refresh_failed",
        message: `Copilotトークン取得失敗 (${res.status})`,
      });
    const data = await res.json();
    return ok({
      providerId: "copilot",
      accessToken: data.token,
      refreshToken: ghAccessToken,
      expiresAt: data.expires_at * 1000 - 5 * 60 * 1000,
      metadata: {
        enterpriseDomain: domain !== "github.com" ? domain : undefined,
      },
    });
  }
}
```

#### Chat API の Base URL 解決

```typescript
// adapters/ai/provider-factory.ts で使用

export function getCopilotBaseUrl(token?: string, enterpriseDomain?: string): string {
  // 優先順位: トークンの proxy-ep > enterpriseDomain > デフォルト
  if (token) {
    const match = token.match(/proxy-ep=([^;]+)/);
    if (match) {
      const apiHost = match[1].replace(/^proxy\./, "api.");
      return `https://${apiHost}`;
    }
  }
  if (enterpriseDomain) return `https://copilot-api.${enterpriseDomain}`;
  return "https://api.individual.githubcopilot.com";
}
```

### NoopAuth (`adapters/auth/noop-auth.ts`)

```typescript
export class NoopAuth implements AuthProvider {
  async login(): Promise<Result<AuthCredentials, AuthError>> {
    return err({
      code: "auth_cancelled",
      message: "このプロバイダーはOAuth認証に対応していません",
    });
  }
  async refresh(): Promise<Result<AuthCredentials, AuthError>> {
    return err({ code: "auth_refresh_failed", message: "リフレッシュ不要" });
  }
  isValid(): boolean {
    return true;
  }
}
```

## セキュリティ考慮

| リスク                             | 対策                                                               |
| ---------------------------------- | ------------------------------------------------------------------ |
| token が chrome.storage に平文保存 | Chrome の暗号化ストレージに依存 (OSレベル)。追加暗号化は過剰と判断 |
| refresh token の漏洩               | chrome.storage.local は拡張ごとに隔離                              |
| PKCE state/verifier のメモリ残存   | login() 完了後にスコープを出て GC                                  |
| Copilot Client ID                  | 既存拡張 と同様 base64 難読化のみ。本質的に公開値                  |

## プロバイダーごとの認証パス

| Provider  | 認証パス                                                            |
| --------- | ------------------------------------------------------------------- |
| anthropic | APIキー → ProviderConfig.apiKey                                     |
| google    | APIキー → ProviderConfig.apiKey                                     |
| openai    | APIキー → ProviderConfig.apiKey / OAuth → ProviderConfig.oauthToken |
| copilot   | OAuth (Device Flow) → ProviderConfig.oauthToken                     |
| local     | なし → ProviderConfig.apiKey = "ollama"                             |

## 関連ドキュメント

- [AI Provider 詳細設計](./ai-provider-detail.md) - provider-factory, Adapter実装
- [AI接続設計 (アーキテクチャ)](../architecture/ai-connection.md) - 方針レベル
- [エラーハンドリング](../architecture/error-handling.md) - AuthError
- [状態管理設計](../architecture/state-management.md) - credentials の永続化
- [OpenAI OAuth 詳細設計](./openai-oauth-detail.md) - OpenAI Codex OAuth 対応
