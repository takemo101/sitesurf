import type { SkillMatch } from "@/shared/skill-types";
import type { AIMessage, UserMessage } from "@/ports/ai-provider";
import { summarizeInstructions } from "@/shared/skill-instructions";

export type SkillDetectionMessage = UserMessage;
export const SKILL_DETECTION_PREFIX = "[System: Skills available now]";

function renderExtractorSkillLines(match: SkillMatch): string {
  const scope = match.skill.scope === "global" ? "global (any page)" : "site-specific";
  const parts: string[] = [`Skill "${match.skill.name}" (id: ${match.skill.id}, ${scope}):`];
  for (const ext of match.availableExtractors) {
    parts.push(`  - ${match.skill.id}.${ext.id}: ${ext.description}`);
  }
  const guidance = summarizeInstructions(match.skill.instructionsMarkdown);
  if (guidance) {
    parts.push(`  Apply: ${guidance}`);
  }
  return parts.join("\n");
}

function renderGuidanceSkillLines(match: SkillMatch, summary: string): string {
  const scope = match.skill.scope === "global" ? "global (any page)" : "site-specific";
  return [
    `Skill "${match.skill.name}" (id: ${match.skill.id}, ${scope}):`,
    `  Apply: ${summary}`,
  ].join("\n");
}

/**
 * ターン直前に AI へ差し込む skill detection メッセージを作る。
 * instruction-only / extractors-only / mixed の 3 形態を尊重するため、
 * skill を役割 (callable extractors vs guidance-only) で分けて提示する。
 * - guidance-only skill は "Apply:" で始まる行動指示として並べ、extractor
 *   呼び出しではないと AI が区別しやすくする
 * - extractor も summary 可能な instruction も無い skill は丸ごと除外する
 * - どの skill にも extractor が無いときは "browserjs() で呼べ" の
 *   トレーリングヒントを省略する (instruction-only では misleading)
 */
export function buildSkillDetectionMessage(
  matches: readonly SkillMatch[],
): SkillDetectionMessage | null {
  if (matches.length === 0) return null;

  const extractorMatches: SkillMatch[] = [];
  const guidanceMatches: { match: SkillMatch; summary: string }[] = [];

  for (const match of matches) {
    if (match.availableExtractors.length > 0) {
      extractorMatches.push(match);
      continue;
    }
    const summary = summarizeInstructions(match.skill.instructionsMarkdown);
    if (summary) {
      guidanceMatches.push({ match, summary });
    }
  }

  if (extractorMatches.length === 0 && guidanceMatches.length === 0) return null;

  const blocks: string[] = [];

  if (extractorMatches.length > 0) {
    const intro =
      "Callable extractors — invoke via `browserjs()` when they fit the task, e.g. `browserjs(() => window.youtube.getVideoInfo())`.";
    blocks.push([intro, "", ...extractorMatches.map(renderExtractorSkillLines)].join("\n\n"));
  }

  if (guidanceMatches.length > 0) {
    const intro =
      "Site guidance — apply the `Apply:` line to your approach and tool choice on this page, even if the user did not explicitly mention it. No functions to call here.";
    blocks.push(
      [
        intro,
        "",
        ...guidanceMatches.map(({ match, summary }) => renderGuidanceSkillLines(match, summary)),
      ].join("\n\n"),
    );
  }

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: `${SKILL_DETECTION_PREFIX}\n\n${blocks.join("\n\n")}`,
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
