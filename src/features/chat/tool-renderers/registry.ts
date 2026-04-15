import type { ToolRenderer, ToolRendererRegistry as ToolRendererRegistryContract } from "./types";

export class ToolRendererRegistry implements ToolRendererRegistryContract {
  private readonly renderers = new Map<string, ToolRenderer>();

  register(toolName: string, renderer: ToolRenderer): void {
    this.renderers.set(toolName, renderer);
  }

  get(toolName: string): ToolRenderer | undefined {
    return this.renderers.get(toolName);
  }

  list(): string[] {
    return [...this.renderers.keys()];
  }
}
