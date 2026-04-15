import type { SkillRegistry } from "@/shared/skill-registry";
import { youtubeSkill } from "./youtube";
import { googleSearchSkill } from "./google-search";

export { youtubeSkill } from "./youtube";
export { googleSearchSkill } from "./google-search";

/**
 * デフォルトスキルをレジストリに登録する
 */
export function registerDefaultSkills(registry: SkillRegistry): void {
  registry.register(youtubeSkill);
  registry.register(googleSearchSkill);
}
