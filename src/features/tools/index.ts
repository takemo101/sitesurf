import type { ToolDefinition } from "@/ports/ai-provider";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import type { StoragePort } from "@/ports/storage";
import type { ToolExecutionHooks, ToolExecutor } from "@/ports/tool-executor";
import { SkillRegistry } from "@/shared/skill-registry";
import { useStore } from "@/store/index";

import { replToolDef, buildReplToolDef, executeRepl, formatSkillsForSandbox } from "./repl";
import { navigateToolDef, executeNavigate } from "./navigate";
import { inspectToolDef, executeInspect } from "./inspect";
import {
  skillToolDef,
  executeSkill,
  type SkillAction,
  type SkillResult,
  type SkillListResult,
  type SkillGetResult,
  type SkillCreateResult,
  type SkillUpdateResult,
  type SkillDeleteResult,
  type CreateSkillDraftArgs,
  type CreateSkillDraftResult,
  type UpdateSkillDraftArgs,
  type UpdateSkillDraftResult,
  type ListSkillDraftsResult,
  type DeleteSkillDraftArgs,
  type DeleteSkillDraftResult,
} from "./skill";
import { bgFetchToolDef, executeBgFetch } from "./bg-fetch";
import { artifactsTool } from "./definitions/artifacts-tool";
import { handleArtifactsTool } from "./handlers/artifacts-handler";

export { replToolDef, buildReplToolDef, executeRepl, formatSkillsForSandbox };
export { navigateToolDef, executeNavigate };
export { inspectToolDef, executeInspect };
export { skillToolDef, executeSkill };
export { bgFetchToolDef, executeBgFetch };
export { artifactsTool, handleArtifactsTool };
export type {
  SkillAction,
  SkillResult,
  SkillListResult,
  SkillGetResult,
  SkillCreateResult,
  SkillUpdateResult,
  SkillDeleteResult,
  CreateSkillDraftArgs,
  CreateSkillDraftResult,
  UpdateSkillDraftArgs,
  UpdateSkillDraftResult,
  ListSkillDraftsResult,
  DeleteSkillDraftArgs,
  DeleteSkillDraftResult,
};
export type { ScreenshotResult, ExtractImageResult } from "./inspect";
export type { ArtifactsParams } from "./handlers/artifacts-handler";
export { loadSkillRegistry } from "./skills";
export type { SkillRegistry } from "@/shared/skill-registry";
export type {
  NavigateResult,
  NavigateSuccessResult,
  ListTabsResult,
  SwitchTabResult,
  TabInfo,
  NavigateArgs,
} from "./navigate";

export const ALL_TOOL_DEFS: ToolDefinition[] = [
  replToolDef,
  navigateToolDef,
  inspectToolDef,
  skillToolDef,
  artifactsTool,
  bgFetchToolDef,
];

export const AGENT_TOOL_DEFS: ToolDefinition[] = [...ALL_TOOL_DEFS];

export function getAgentToolDefs(options?: { enableBgFetch?: boolean }): ToolDefinition[] {
  const enableBgFetch = options?.enableBgFetch ?? false;
  const replWithBgFetch = buildReplToolDef({ enableBgFetch });
  let defs = AGENT_TOOL_DEFS.map((tool) => (tool.name === "repl" ? replWithBgFetch : tool));
  if (!enableBgFetch) {
    defs = defs.filter((tool) => tool.name !== "bg_fetch");
  }
  return defs;
}

export type { ToolExecutor };

export function createToolExecutorWithSkills(
  skillRegistry: SkillRegistry,
  artifactStorage: ArtifactStoragePort & { setSessionId(id: string | null): void },
  storage: StoragePort,
): ToolExecutor {
  return async (name, args, browser, signal, hooks?: ToolExecutionHooks) => {
    // Ensure storage session ID matches current session
    const currentSessionId = useStore.getState().activeSessionId;
    if (currentSessionId !== undefined) {
      artifactStorage.setSessionId(currentSessionId);
    }

    switch (name) {
      case "repl": {
        const tab = await browser.getActiveTab();
        const skillMatches = skillRegistry.getAvailableSkills(tab.url ?? undefined);
        return executeRepl(
          browser,
          artifactStorage,
          args as { title?: string; code: string },
          skillMatches,
          signal,
          hooks?.onConsoleLog,
        );
      }
      case "navigate":
        return executeNavigate(
          browser,
          args as { url?: string; newTab?: boolean; listTabs?: boolean; switchToTab?: number },
        );
      case "inspect":
        return executeInspect(
          browser,
          args as {
            action: "pick_element" | "screenshot" | "extract_image";
            message?: string;
            selector?: string;
            selectors?: string[];
            maxWidth?: number;
          },
        );
      case "bg_fetch": {
        const bgFetchEnabled = useStore.getState().settings.enableBgFetch;
        if (!bgFetchEnabled) {
          return {
            ok: false as const,
            error: {
              code: "tool_script_error" as const,
              message: "bg_fetch is disabled in settings",
            },
          };
        }
        return executeBgFetch(args);
      }
      case "skill": {
        const tab = await browser.getActiveTab();
        return executeSkill(storage, skillRegistry, tab.url, args as SkillAction);
      }
      case "artifacts": {
        const artifactArgs = args as unknown as Parameters<typeof handleArtifactsTool>[0];
        const store = useStore.getState();
        const artifactSlice = {
          artifacts: store.artifacts,
          selectedArtifact: store.selectedArtifact,
          setArtifacts: store.setArtifacts,
          selectArtifact: store.selectArtifact,
          setArtifactPanelOpen: store.setArtifactPanelOpen,
        };
        const result = await handleArtifactsTool(
          artifactArgs,
          artifactStorage,
          artifactSlice,
          signal,
        );
        if (result.isError) {
          return {
            ok: false as const,
            error: { code: "tool_script_error" as const, message: result.content },
          };
        }

        const command = artifactArgs?.command;
        const filename = artifactArgs?.filename ?? "";
        const shouldParseJson = command === "get" && filename.endsWith(".json");
        const value = shouldParseJson ? tryParseJson(result.content) : result.content;

        return {
          ok: true as const,
          value,
        };
      }
      default:
        return {
          ok: false as const,
          error: { code: "tool_script_error", message: `Unknown tool: ${name}` },
        };
    }
  };
}

function tryParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
