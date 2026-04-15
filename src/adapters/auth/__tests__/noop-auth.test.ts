import { describe, expect, it } from "vitest";
import { NoopAuth } from "../noop-auth";
import type { AuthCredentials } from "@/ports/auth-provider";

const dummyCredentials: AuthCredentials = {
  providerId: "anthropic",
  accessToken: "token",
  refreshToken: "refresh",
  expiresAt: Date.now() + 3600_000,
  metadata: {},
};

describe("NoopAuth", () => {
  it("login returns auth_cancelled error", async () => {
    const auth = new NoopAuth();
    const result = await auth.login({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("auth_cancelled");
    }
  });

  it("refresh returns auth_refresh_failed error", async () => {
    const auth = new NoopAuth();
    const result = await auth.refresh(dummyCredentials);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("auth_refresh_failed");
    }
  });

  it("isValid always returns true", () => {
    const auth = new NoopAuth();
    expect(auth.isValid(dummyCredentials)).toBe(true);
  });
});
