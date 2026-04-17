import { describe, expect, it, vi } from "vitest";
import { InMemoryToolResultStore } from "@/adapters/storage/in-memory-storage";
import type { ToolResultStorePort } from "@/ports/tool-result-store";
import { executeGetToolResult, getToolResultToolDef } from "../get-tool-result";

describe("get_tool_result", () => {
  it("returns stored result for a matching session", async () => {
    const store = new InMemoryToolResultStore();
    await store.save("session-1", {
      key: "tc_key",
      toolName: "read_page",
      fullValue: "FULL",
      summary: "SUMMARY",
      turnIndex: 0,
    });

    const result = await executeGetToolResult(store, "session-1", { key: "tc_key" });

    expect(result).toEqual({
      ok: true,
      value: {
        key: "tc_key",
        toolName: "read_page",
        fullValue: "FULL",
        summary: "SUMMARY",
      },
    });
  });

  it("returns tool error when store lookup throws", async () => {
    const store: ToolResultStorePort = {
      save: vi.fn(),
      get: vi.fn().mockRejectedValue(new Error("IndexedDB offline")),
      list: vi.fn(),
      deleteSession: vi.fn(),
    };

    await expect(executeGetToolResult(store, "session-1", { key: "tc_key" })).resolves.toEqual({
      ok: false,
      error: {
        code: "tool_script_error",
        message: "Stored tool result could not be loaded for key: tc_key",
      },
    });
  });

  it("defines key as a required parameter", () => {
    const parameters = getToolResultToolDef.parameters as { required?: string[] };
    expect(parameters.required).toContain("key");
  });
});
