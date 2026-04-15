import { streamText as sdkStreamText } from "ai";
import type {
  AIProvider,
  StreamEvent,
  StreamTextParams,
  ProviderConfig,
} from "@/ports/ai-provider";
import { createLogger } from "@/shared/logger";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";
import { estimateTokens } from "@/shared/token-utils";
import { toAIError, toSDKMessages, toSDKTools, toStreamEvent } from "./converters";
import { createModelFactory } from "./provider-factory";

const log = createLogger("vercel-ai-adapter");

export class VercelAIAdapter implements AIProvider {
  private readonly modelFactory: ReturnType<typeof createModelFactory>;

  constructor(private readonly config: ProviderConfig) {
    this.modelFactory = createModelFactory(config);
  }

  async *streamText(params: StreamTextParams): AsyncIterable<StreamEvent> {
    log.debug("streamText", { model: params.model, messageCount: params.messages.length });

    const model = this.modelFactory(params.model);
    const isResponsesApi = this.config.apiMode === "responses";

    // Responses API では messages 配列に system を含めず、
    // instructions パラメータを使用する
    const messages = toSDKMessages(params.messages);
    const promptTokenEstimate = estimateTokens(params.messages);
    log.info("streamText tokens", {
      model: params.model,
      estimatedPromptTokens: promptTokenEstimate,
    });

    // Responses API では maxOutputTokens がサポートされていない
    const maxOutputTokens = isResponsesApi ? undefined : (params.maxTokens ?? DEFAULT_MAX_TOKENS);

    const result = sdkStreamText({
      model,
      // Responses API では system パラメータではなく instructions を使用
      ...(isResponsesApi ? {} : { system: params.systemPrompt }),
      messages,
      tools: toSDKTools(params.tools),
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      abortSignal: params.abortSignal,
      providerOptions: this.buildProviderOptions(params),
    });

    try {
      for await (const part of result.fullStream) {
        const event = toStreamEvent(part as Record<string, unknown>);
        if (event) yield event;
      }
    } catch (error: unknown) {
      log.error("streamText error", error);
      yield { type: "error", error: toAIError(error) };
    }
  }

  private buildProviderOptions(params: StreamTextParams) {
    const options: Record<string, Record<string, string | boolean | number>> = {};

    // OpenAI Responses API 設定
    if (this.config.apiMode === "responses") {
      options.openai = {
        ...(params.systemPrompt ? { instructions: params.systemPrompt } : {}),
        store: false,
      };
    }

    if (params.reasoningEffort) {
      options.openai = {
        ...options.openai,
        reasoningEffort: params.reasoningEffort,
      };
    }

    if (this.config.provider === "google") {
      options.google = { thoughtSignature: "skip_thought_signature_validator" };
    }

    return Object.keys(options).length > 0 ? options : undefined;
  }
}
