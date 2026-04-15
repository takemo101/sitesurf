import type { BrowserExecutor } from "@/ports/browser-executor";
import type { AuthCallbacks, AuthCredentials, AuthProvider } from "@/ports/auth-provider";
import type { AuthError, Result } from "@/shared/errors";
import { err, ok } from "@/shared/errors";

// =============================================================================
// Constants
// =============================================================================

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const REDIRECT_HOST = "localhost:1455";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// =============================================================================
// Main Class
// =============================================================================

export class OpenAIAuth implements AuthProvider {
  constructor(
    private readonly browser: BrowserExecutor,
    private readonly providerId: string = "openai",
  ) {}

  async login(callbacks: AuthCallbacks): Promise<Result<AuthCredentials, AuthError>> {
    callbacks.onProgress?.("starting");

    const { verifier, challenge } = await generatePKCE();
    const state = generateState();
    const authUrl = buildAuthUrl(challenge, state);

    callbacks.onProgress?.("waiting-for-user");

    let redirectUrl: URL;
    try {
      redirectUrl = await this.waitForRedirect(authUrl.toString());
    } catch {
      return err({ code: "auth_cancelled", message: "認証がキャンセルされました" });
    }

    const code = redirectUrl.searchParams.get("code");
    if (!code) {
      return err({ code: "auth_cancelled", message: "認証コードが取得できませんでした" });
    }

    if (redirectUrl.searchParams.get("state") !== state) {
      return err({ code: "auth_cancelled", message: "認証状態が一致しません" });
    }

    callbacks.onProgress?.("exchanging-token");

    try {
      const tokenData = await exchangeCode(code, verifier);
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
          scope: "openid profile email offline_access",
        }),
      });

      if (!res.ok) {
        return err({
          code: "auth_refresh_failed",
          message: `リフレッシュ失敗 (${res.status})`,
        });
      }

      return ok(this.toCredentials(await res.json()));
    } catch (e: unknown) {
      return err({
        code: "auth_network",
        message: "リフレッシュ中にネットワークエラー",
        cause: e,
      });
    }
  }

  isValid(credentials: AuthCredentials): boolean {
    return Date.now() < credentials.expiresAt - REFRESH_MARGIN_MS;
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

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
            cleanup();
            resolve(parsed);
          }
        } catch {
          /* invalid URL */
        }
      });

      const unsubRemoved = this.browser.onTabRemoved((id) => {
        if (id !== tabId || settled) return;
        settled = true;
        cleanup();
        reject(new Error("Auth tab closed by user"));
      });

      const cleanup = () => {
        unsubUpdated();
        unsubRemoved();
      };
    });
  }

  private toCredentials(data: Record<string, unknown>): AuthCredentials {
    const accessToken = data.access_token as string;
    const idToken = data.id_token as string | undefined;
    const accountId = extractAccountId(idToken) ?? extractSubFromJwt(accessToken);

    return {
      providerId: this.providerId,
      accessToken,
      refreshToken: data.refresh_token as string,
      expiresAt: Date.now() + (data.expires_in as number) * 1000,
      metadata: { accountId },
    };
  }
}

// =============================================================================
// PKCE & State
// =============================================================================

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(hash));
  return { verifier, challenge };
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// =============================================================================
// URL Building
// =============================================================================

function buildAuthUrl(challenge: string, state: string): URL {
  const url = new URL("https://auth.openai.com/oauth/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "openid profile email offline_access");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  // Extension-specific params
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", "sitesurf");
  url.searchParams.set("id_token_add_organizations", "true");
  return url;
}

// =============================================================================
// Token Exchange
// =============================================================================

async function exchangeCode(code: string, verifier: string): Promise<Record<string, unknown>> {
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

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  return res.json();
}

// =============================================================================
// JWT Parsing
// =============================================================================

function extractAccountId(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined;

  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    const auth = payload["https://api.openai.com/auth"];
    const accountId = auth?.chatgpt_account_id;
    return typeof accountId === "string" && accountId.length > 0 ? accountId : undefined;
  } catch {
    return undefined;
  }
}

function extractSubFromJwt(token: string): string | undefined {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub;
  } catch {
    return undefined;
  }
}
