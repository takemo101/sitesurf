import { describe, expect, it } from "vitest";

import { buildSkillDetectionMessage } from "../skill-detector";
import type { SkillMatch } from "@/features/tools/skills";

describe("buildSkillDetectionMessage", () => {
  it("guides the model to call runtime-injected skill extractors", () => {
    const matches: SkillMatch[] = [
      {
        skill: {
          id: "youtube",
          name: "YouTube",
          description: "YouTube skill",
          matchers: { hosts: ["youtube.com"] },
          version: "1.0.0",
          extractors: [
            {
              id: "getVideoInfo",
              name: "Video Info",
              description: "Get video info",
              code: "function () { return document.title; }",
              outputSchema: "string",
            },
          ],
        },
        availableExtractors: [
          {
            id: "getVideoInfo",
            name: "Video Info",
            description: "Get video info",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
        confidence: 100,
      },
    ];

    const message = buildSkillDetectionMessage(matches);

    expect(message).not.toBeNull();
    const text = message?.content[0];
    expect(text?.type).toBe("text");
    if (text?.type !== "text") return;

    expect(text.text).not.toContain("browserjs(new Function(code))");
    expect(text.text).not.toContain("new Function(`return (${code})`)()");
    expect(text.text).toContain("window.youtube.getVideoInfo()");
  });
});
