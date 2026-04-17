import { describe, expect, it } from "vitest";
import { InMemoryToolResultStore } from "@/adapters/storage/in-memory-storage";
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

  it("defines key as a required parameter", () => {
    const parameters = getToolResultToolDef.parameters as { required?: string[] };
    expect(parameters.required).toContain("key");
  });
});
