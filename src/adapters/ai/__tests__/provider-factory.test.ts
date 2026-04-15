import { describe, expect, it } from "vitest";
import { getCopilotBaseUrl } from "../provider-factory";

describe("getCopilotBaseUrl", () => {
  it("extracts base URL from token with proxy-ep", () => {
    const token = "ghu_abc;proxy-ep=proxy.example.com;ts=123";
    expect(getCopilotBaseUrl(token)).toBe("https://api.example.com");
  });

  it("uses enterprise domain when no proxy-ep in token", () => {
    expect(getCopilotBaseUrl("ghu_abc", "github.enterprise.com")).toBe(
      "https://copilot-api.github.enterprise.com",
    );
  });

  it("uses default when no token and no enterprise domain", () => {
    expect(getCopilotBaseUrl()).toBe("https://api.individual.githubcopilot.com");
  });

  it("uses default when token has no proxy-ep and no enterprise domain", () => {
    expect(getCopilotBaseUrl("ghu_simple_token")).toBe("https://api.individual.githubcopilot.com");
  });
});
