import type { BrowserExecutor } from "./browser-executor";
import type { AppError, Result } from "@/shared/errors";

export interface ToolExecutionHooks {
  onConsoleStart?: () => void;
  onConsoleLog?: (message: string) => void;
}

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  browserExecutor: BrowserExecutor,
  signal?: AbortSignal,
  hooks?: ToolExecutionHooks,
) => Promise<Result<unknown, AppError>>;
