import { describe, expect, it } from "vitest";
import { createDefaultToolRendererRegistry } from "../index";

describe("createDefaultToolRendererRegistry", () => {
  it("既定の specialized renderer を登録した registry を返す", () => {
    const registry = createDefaultToolRendererRegistry();

    expect(registry.get("repl")).toBeDefined();
    expect(registry.get("inspect")).toBeDefined();
    expect(registry.get("artifacts")).toBeDefined();
    expect(registry.get("bg_fetch")).toBeDefined();
    expect(registry.get("pick_element")).toBeUndefined();
    expect(registry.get("screenshot")).toBeUndefined();
    expect(registry.get("extract_image")).toBeUndefined();
  });
});
