import type { ToolDefinition } from "@/ports/ai-provider";
import type { ToolResultStorePort } from "@/ports/tool-result-store";
import { err, ok, type Result, type ToolError } from "@/shared/errors";

export interface GetToolResultArgs {
  key: string;
}

export interface GetToolResultValue {
  key: string;
  toolName: string;
  fullValue: string;
  summary: string;
}

export const getToolResultToolDef: ToolDefinition = {
  name: "get_tool_result",
  description:
    "Retrieve the full content of a previous tool result by key. " +
    "Keys appear in summaries as 'tool_result://<key>'. " +
    "After one turn, the retrieved content returns to summary form.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "Key from a previous tool result summary",
      },
    },
    required: ["key"],
  },
};

export async function executeGetToolResult(
  store: ToolResultStorePort,
  sessionId: string,
  args: GetToolResultArgs,
): Promise<Result<GetToolResultValue, ToolError>> {
  if (!args.key) {
    return err({ code: "tool_script_error", message: "key is required" });
  }

  const result = await store.get(sessionId, args.key);
  if (!result) {
    return err({
      code: "tool_script_error",
      message: `Stored tool result not found for key: ${args.key}`,
    });
  }

  return ok({
    key: result.key,
    toolName: result.toolName,
    fullValue: result.fullValue,
    summary: result.summary,
  });
}
