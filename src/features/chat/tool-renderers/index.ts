import { defaultConsoleLogService } from "../services/console-log";
import { bgFetchToolRenderer } from "./bg-fetch-renderer";
import { artifactsToolRenderer, extractImageToolRenderer, replToolRenderer } from "./components";
import { ToolRendererRegistry } from "./registry";

export function createDefaultToolRendererRegistry(consoleLogService = defaultConsoleLogService) {
  const registry = new ToolRendererRegistry();
  void consoleLogService;
  registry.register("repl", replToolRenderer);
  registry.register("inspect", extractImageToolRenderer);
  registry.register("artifacts", artifactsToolRenderer);
  registry.register("bg_fetch", bgFetchToolRenderer);
  return registry;
}

export const defaultToolRendererRegistry = createDefaultToolRendererRegistry();
