import type { SkillMatch } from "@/shared/skill-types";
import type { AIMessage, UserMessage } from "@/ports/ai-provider";
import { summarizeInstructions } from "@/shared/skill-instructions";

export type SkillDetectionMessage = UserMessage;
export const SKILL_DETECTION_PREFIX = "[System: Skills available now]";

/**
 * ターン直前に AI へ差し込む skill detection メッセージを作る。
 * instruction-only / extractors-only / mixed の 3 形態を尊重するため、
 * - extractor が無い skill は extractor bullet を出さず Guidance だけを出す
 * - extractor も summarize 可能な instruction も無い skill は丸ごと除外する
 * - すべての listed skill が extractor を持たないときは "browserjs() で呼べ" の
 *   トレーリングヒントを省略する (instruction-only では misleading)
 */
export function buildSkillDetectionMessage(
  matches: readonly SkillMatch[],
): SkillDetectionMessage | null {
  if (matches.length === 0) return null;

  const visible = matches.filter((match) => {
    if (match.availableExtractors.length > 0) return true;
    return summarizeInstructions(match.skill.instructionsMarkdown) !== null;
  });

  if (visible.length === 0) return null;

  const lines = visible.map((m) => {
    const scope = m.skill.scope === "global" ? "global (any page)" : "site-specific";
    const parts: string[] = [`Skill "${m.skill.name}" (id: ${m.skill.id}, ${scope}):`];

    for (const ext of m.availableExtractors) {
      parts.push(`  - ${m.skill.id}.${ext.id}: ${ext.description}`);
    }

    const guidance = summarizeInstructions(m.skill.instructionsMarkdown);
    if (guidance) {
      parts.push(`  Guidance: ${guidance}`);
    }

    return parts.join("\n");
  });

  const hasAnyExtractor = visible.some((m) => m.availableExtractors.length > 0);
  const callHint = hasAnyExtractor
    ? "\n\nCall matching skill extractors directly inside `browserjs()` via the runtime-injected window object, for example: `browserjs(() => window.youtube.getVideoInfo())`."
    : "";

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: `${SKILL_DETECTION_PREFIX}\n\n${lines.join("\n\n")}${callHint}`,
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
