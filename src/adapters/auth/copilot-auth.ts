import type { BrowserExecutor } from "@/ports/browser-executor";
import type {
  AuthCallbacks,
  AuthCredentials,
  AuthProvider,
  LoginOptions,
} from "@/ports/auth-provider";
import type { AuthError, Result } from "@/shared/errors";
import { err, ok } from "@/shared/errors";
import { sleep } from "@/shared/utils";

const GH_CLIENT_ID = atob("SXYxLmI1MDdhMDhjODdlY2ZlOTg=");

export class CopilotAuth implements AuthProvider {
  constructor(private readonly browser: BrowserExecutor) {}

  async login(
    callbacks: AuthCallbacks,
    options?: LoginOptions,
  ): Promise<Result<AuthCredentials, AuthError>> {
    callbacks.onProgress?.("starting");

    const domain = options?.enterpriseDomain
      ? normalizeDomain(options.enterpriseDomain) || "github.com"
      : "github.com";
    const urls = getUrls(domain);

    const deviceRes = await fetch(urls.deviceCodeUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GH_CLIENT_ID,
        scope: "read:user",
      }),
    });
    if (!deviceRes.ok)
      return err({
        code: "auth_network",
        message: `Device Code の取得に失敗 (${domain})`,
      });
    const device = await deviceRes.json();

    callbacks.onDeviceCode?.({
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      interval: device.interval,
    });
    callbacks.onProgress?.("waiting-for-user");
    this.browser.openTab(device.verification_uri);

    const ghToken = await this.pollForToken(
      domain,
      device.device_code,
      device.interval,
      device.expires_in,
    );
    if (!ghToken.ok) return ghToken;

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
        return err({
          code: "auth_cancelled",
          message: `GitHub認証エラー: ${data.error}`,
        });
    }
    return err({
      code: "auth_cancelled",
      message: "認証がタイムアウトしました",
    });
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

function getUrls(domain: string) {
  return {
    deviceCodeUrl: `https://${domain}/login/device/code`,
    accessTokenUrl: `https://${domain}/login/oauth/access_token`,
    copilotTokenUrl: `https://api.${domain}/copilot_internal/v2/token`,
  };
}

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
