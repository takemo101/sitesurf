import { lookupModelContextWindow } from "@/shared/model-utils";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";
import { createLogger } from "@/shared/logger";

const log = createLogger("context-budget");

export interface ContextBudget {
  windowTokens: number;
  outputReserve: number;
  inputBudget: number;
  maxToolResultChars: number;
  compressionThreshold: number;
  trimThreshold: number;
}

export function getContextBudget(model: string, settingsMaxTokens?: number): ContextBudget {
  const windowTokens = lookupModelContextWindow(model);
  const requestedOutput = settingsMaxTokens ?? DEFAULT_MAX_TOKENS;
  const outputReserve = Math.min(requestedOutput, Math.floor(windowTokens * 0.5));

  if (requestedOutput > outputReserve) {
    log.info("maxTokens clamped", {
      requested: requestedOutput,
      effective: outputReserve,
      windowTokens,
    });
  }

  const inputBudget = windowTokens - outputReserve;

  return {
    windowTokens,
    outputReserve,
    inputBudget,
    maxToolResultChars:
      inputBudget >= 150_000
        ? 20_000
        : inputBudget >= 80_000
          ? 10_000
          : inputBudget >= 40_000
            ? 4_000
            : inputBudget >= 20_000
              ? 2_000
              : 1_000,
    compressionThreshold: Math.floor(inputBudget * 0.6),
    trimThreshold: Math.floor(inputBudget * 0.85),
  };
}
