import type { SkillMatch } from "@/shared/skill-types";
import type { AIMessage, UserMessage } from "@/ports/ai-provider";

export type SkillDetectionMessage = UserMessage;
export const SKILL_DETECTION_PREFIX = "[System: Skills available now]";

export function buildSkillDetectionMessage(
  matches: readonly SkillMatch[],
): SkillDetectionMessage | null {
  if (matches.length === 0) return null;

  const lines = matches.map((m) => {
    const extractors = m.availableExtractors
      .map((e) => `  - ${m.skill.id}.${e.id}: ${e.description}`)
      .join("\n");
    const scope = m.skill.scope === "global" ? "global (any page)" : "site-specific";
    return `Skill "${m.skill.name}" (id: ${m.skill.id}, ${scope}):\n${extractors}`;
  });

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: `${SKILL_DETECTION_PREFIX}\n\n${lines.join("\n\n")}\n\nCall matching skill extractors directly inside \`browserjs()\` via the runtime-injected window object, for example: \`browserjs(() => window.youtube.getVideoInfo())\`.`,
      },
    ],
  };
}

export function isSkillDetectionMessage(message: AIMessage): boolean {
  if (message.role !== "user") {
    return false;
  }

  return message.content.some(
    (part) => part.type === "text" && part.text?.startsWith(SKILL_DETECTION_PREFIX),
  );
}
