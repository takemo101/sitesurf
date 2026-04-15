import type { AuthError, Result } from "@/shared/errors";

export interface LoginOptions {
  enterpriseDomain?: string;
}

export interface AuthProvider {
  login(
    callbacks: AuthCallbacks,
    options?: LoginOptions,
  ): Promise<Result<AuthCredentials, AuthError>>;
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
  expiresAt: number;
  metadata: AuthMetadata;
}

export interface AuthMetadata {
  accountId?: string;
  enterpriseDomain?: string;
}
