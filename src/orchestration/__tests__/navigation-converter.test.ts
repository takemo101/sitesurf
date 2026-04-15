import { describe, expect, it } from "vitest";
import { convertNavigationForAPI } from "../navigation-converter";
import type { ChatMessage } from "@/ports/session-types";

describe("convertNavigationForAPI", () => {
  it("converts navigation ChatMessage to user AIMessage", () => {
    const nav: ChatMessage = {
      id: "nav-1",
      role: "navigation",
      content: "Example Domain",
      timestamp: 1000,
      url: "https://example.com",
    };

    const result = convertNavigationForAPI(nav);

    expect(result).toEqual({
      role: "user",
      content: [
        {
          type: "text",
          text: "[ページ遷移] Example Domain\nURL: https://example.com",
        },
      ],
    });
  });

  it("handles navigation with undefined url", () => {
    const nav: ChatMessage = {
      id: "nav-2",
      role: "navigation",
      content: "New Tab",
      timestamp: 2000,
    };

    const result = convertNavigationForAPI(nav);

    expect(result).toEqual({
      role: "user",
      content: [
        {
          type: "text",
          text: "[ページ遷移] New Tab\nURL: undefined",
        },
      ],
    });
  });
});
