import { describe, expect, it } from "vitest";
import { calculateBackoff, isRetryable, RETRY_CONFIG } from "../retry";
import type { AppError } from "@/shared/errors";

describe("isRetryable", () => {
  it("returns true for ai_rate_limit", () => {
    const error: AppError = { code: "ai_rate_limit", message: "rate limited" };
    expect(isRetryable(error)).toBe(true);
  });

  it("returns true for ai_network", () => {
    const error: AppError = { code: "ai_network", message: "network error" };
    expect(isRetryable(error)).toBe(true);
  });

  it("returns false for ai_auth_invalid", () => {
    const error: AppError = { code: "ai_auth_invalid", message: "invalid key" };
    expect(isRetryable(error)).toBe(false);
  });

  it("returns false for ai_model_not_found", () => {
    const error: AppError = { code: "ai_model_not_found", message: "not found" };
    expect(isRetryable(error)).toBe(false);
  });

  it("returns false for ai_unknown", () => {
    const error: AppError = { code: "ai_unknown", message: "unknown" };
    expect(isRetryable(error)).toBe(false);
  });
});

describe("calculateBackoff", () => {
  it("returns retryAfterMs when present on error", () => {
    const error = { code: "ai_rate_limit", message: "rate limited", retryAfterMs: 5000 };
    expect(calculateBackoff(1, error)).toBe(5000);
  });

  it("calculates exponential backoff for attempt 1", () => {
    const error: AppError = { code: "ai_rate_limit", message: "rate limited" };
    const delay = calculateBackoff(1, error);
    expect(delay).toBeGreaterThanOrEqual(RETRY_CONFIG.baseDelayMs);
    expect(delay).toBeLessThanOrEqual(RETRY_CONFIG.baseDelayMs + 500);
  });

  it("calculates exponential backoff for attempt 2", () => {
    const error: AppError = { code: "ai_rate_limit", message: "rate limited" };
    const delay = calculateBackoff(2, error);
    const expectedBase = RETRY_CONFIG.baseDelayMs * RETRY_CONFIG.backoffMultiplier;
    expect(delay).toBeGreaterThanOrEqual(expectedBase);
    expect(delay).toBeLessThanOrEqual(expectedBase + 500);
  });

  it("caps delay at maxDelayMs", () => {
    const error: AppError = { code: "ai_rate_limit", message: "rate limited" };
    const delay = calculateBackoff(100, error);
    expect(delay).toBeLessThanOrEqual(RETRY_CONFIG.maxDelayMs);
  });
});
