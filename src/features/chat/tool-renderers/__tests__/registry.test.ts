import { describe, expect, it } from "vitest";
import type { ToolRenderer } from "../types";
import { ToolRendererRegistry } from "../registry";

function createRenderer(label: string): ToolRenderer {
  return {
    renderExecuting: () => label,
    renderSuccess: () => label,
    renderError: () => label,
    renderSummary: () => label,
  };
}

describe("ToolRendererRegistry", () => {
  it("register したレンダラーを get で取得できる", () => {
    const registry = new ToolRendererRegistry();
    const renderer = createRenderer("repl");

    registry.register("repl", renderer);

    expect(registry.get("repl")).toBe(renderer);
  });

  it("未登録のツール名では undefined を返す", () => {
    const registry = new ToolRendererRegistry();

    expect(registry.get("unknown_tool")).toBeUndefined();
  });

  it("登録済みツール名の一覧を返せる", () => {
    const registry = new ToolRendererRegistry();

    registry.register("repl", createRenderer("repl"));
    registry.register("artifacts", createRenderer("artifacts"));

    expect(registry.list()).toStrictEqual(["repl", "artifacts"]);
  });
});
