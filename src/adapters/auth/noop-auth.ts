import type { AuthCallbacks, AuthCredentials, AuthProvider } from "@/ports/auth-provider";
import type { AuthError, Result } from "@/shared/errors";
import { err } from "@/shared/errors";

export class NoopAuth implements AuthProvider {
  async login(_callbacks: AuthCallbacks): Promise<Result<AuthCredentials, AuthError>> {
    return err({
      code: "auth_cancelled",
      message: "このプロバイダーはOAuth認証に対応していません",
    });
  }

  async refresh(_credentials: AuthCredentials): Promise<Result<AuthCredentials, AuthError>> {
    return err({
      code: "auth_refresh_failed",
      message: "リフレッシュ不要",
    });
  }

  isValid(_credentials: AuthCredentials): boolean {
    return true;
  }
}
