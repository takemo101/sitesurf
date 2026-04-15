import { defaultConsoleLogService } from "../services/console-log";
import { artifactsToolRenderer, extractImageToolRenderer, replToolRenderer } from "./components";
import { ToolRendererRegistry } from "./registry";

export function createDefaultToolRendererRegistry(consoleLogService = defaultConsoleLogService) {
  const registry = new ToolRendererRegistry();
  void consoleLogService;
  registry.register("repl", replToolRenderer);
  registry.register("extract_image", extractImageToolRenderer);
  registry.register("artifacts", artifactsToolRenderer);
  return registry;
}

export const defaultToolRendererRegistry = createDefaultToolRendererRegistry();
