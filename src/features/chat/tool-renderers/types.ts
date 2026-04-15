import type { ReactNode } from "react";
import type { ToolCallInfo } from "@/ports/session-types";
import type { ConsoleLogService } from "../services/console-log";

export interface ToolRendererContext {
  toolCall: ToolCallInfo;
  consoleLogService: ConsoleLogService;
}

export interface ToolRenderer {
  renderExecuting(context: ToolRendererContext): ReactNode;
  renderSuccess(context: ToolRendererContext): ReactNode;
  renderError(context: ToolRendererContext): ReactNode;
  renderSummary(context: ToolRendererContext): ReactNode;
}

export interface ToolRendererRegistry {
  register(toolName: string, renderer: ToolRenderer): void;
  get(toolName: string): ToolRenderer | undefined;
  list(): string[];
}
