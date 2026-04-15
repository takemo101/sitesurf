import type { AppError } from "@/shared/errors";

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
} as const;

export function isRetryable(error: AppError): boolean {
  return error.code === "ai_rate_limit" || error.code === "ai_network";
}

export function calculateBackoff(attempt: number, error: AppError): number {
  if ("retryAfterMs" in error && typeof (error as RetryableError).retryAfterMs === "number") {
    return (error as RetryableError).retryAfterMs;
  }

  const delay =
    RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1) +
    Math.random() * 500;

  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

interface RetryableError extends AppError {
  retryAfterMs: number;
}
