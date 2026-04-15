import type {
  AIProvider,
  StreamEvent,
  StreamTextParams,
  AIMessage,
  ToolDefinition,
} from "@/ports/ai-provider";
import type { AppError } from "@/shared/errors";
import { createLogger } from "@/shared/logger";

const log = createLogger("openai-codex-adapter");

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// =============================================================================
// Types
// =============================================================================

interface CodexTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

type CodexInputItem =
  | { role: "user"; content: Array<{ type: "input_text"; text: string }> }
  | { role: "assistant"; content: Array<{ type: "output_text"; text: string }> }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

interface RequestBody {
  model: string;
  store: boolean;
  stream: boolean;
  instructions: string;
  input: CodexInputItem[];
  tools?: CodexTool[];
  tool_choice?: "auto" | "none" | "required";
  parallel_tool_calls?: boolean;
  temperature?: number;
  text?: { verbosity?: string };
  include?: string[];
  prompt_cache_key?: string;
}

interface FunctionCallInfo {
  name: string;
  callId: string;
}

// =============================================================================
// Main Adapter
// =============================================================================

export class OpenAICodexAdapter implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly accountId?: string,
  ) {}

  async *streamText(params: StreamTextParams): AsyncIterable<StreamEvent> {
    log.debug("streamText", { model: params.model, messageCount: params.messages.length });

    const sessionId = generateSessionId();
    const accountId = this.accountId || extractAccountIdFromJwt(this.apiKey);

    const request = this.buildRequest(params, sessionId);
    const headers = buildHeaders(this.apiKey, accountId, sessionId);

    try {
      const response = await this.executeWithRetry(request, headers, params.abortSignal);

      if (!response.body) {
        throw new Error("No response body");
      }

      yield* parseEventStream(response.body);
    } catch (error) {
      yield { type: "error", error: toAppError(error) };
    }
  }

  private buildRequest(params: StreamTextParams, sessionId: string): RequestBody {
    const body: RequestBody = {
      model: params.model,
      store: false,
      stream: true,
      instructions: params.systemPrompt ?? "You are a helpful assistant.",
      input: convertMessages(params.messages),
      text: { verbosity: "medium" },
      include: ["reasoning.encrypted_content"],
      prompt_cache_key: sessionId,
      tool_choice: "auto",
      parallel_tool_calls: true,
    };

    if (params.tools?.length) {
      body.tools = convertTools(params.tools);
    }

    return body;
  }

  private async executeWithRetry(
    body: RequestBody,
    headers: Record<string, string>,
    abortSignal?: AbortSignal,
  ): Promise<Response> {
    const url = `${this.baseUrl}/codex/responses`;
    const bodyJson = JSON.stringify(body);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: bodyJson,
          signal: abortSignal,
        });

        if (response.ok) {
          return response;
        }

        const errorText = await response.text();
        const errorInfo = parseErrorResponse(response.status, errorText);

        log.error("API Error", { status: response.status, error: errorText });

        if (errorInfo.friendlyMessage) {
          throw new Error(errorInfo.friendlyMessage);
        }

        if (attempt < MAX_RETRIES && isRetryable(response.status, errorText)) {
          await delay(BASE_DELAY_MS * 2 ** attempt, abortSignal);
          continue;
        }

        throw new Error(errorInfo.message);
      } catch (error) {
        if (error instanceof Error && error.message === "Request was aborted") {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES && !lastError.message.includes("usage limit")) {
          await delay(BASE_DELAY_MS * 2 ** attempt, abortSignal);
        } else {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error("Failed after retries");
  }
}

// =============================================================================
// Request Building
// =============================================================================

function buildHeaders(
  apiKey: string,
  accountId: string,
  sessionId: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "ChatGPT-Account-Id": accountId,
    "OpenAI-Beta": "responses=experimental",
    originator: "sitesurf",
    "User-Agent": "SiteSurf/1.0",
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    session_id: sessionId,
  };
}

// =============================================================================
// Error Handling
// =============================================================================

function parseErrorResponse(
  status: number,
  errorText: string,
): { message: string; friendlyMessage?: string } {
  let message = errorText || `Request failed (${status})`;
  let friendlyMessage: string | undefined;

  try {
    const parsed = JSON.parse(errorText) as {
      error?: {
        code?: string;
        type?: string;
        message?: string;
        plan_type?: string;
        resets_at?: number;
      };
    };
    const err = parsed?.error;
    if (err) {
      const code = err.code || err.type || "";

      if (
        /usage_limit_reached|usage_not_included|rate_limit_exceeded/i.test(code) ||
        status === 429
      ) {
        const plan = err.plan_type ? ` (${err.plan_type.toLowerCase()} plan)` : "";
        const mins = err.resets_at
          ? Math.max(0, Math.round((err.resets_at * 1000 - Date.now()) / 60000))
          : undefined;
        const when = mins !== undefined ? ` Try again in ~${mins} min.` : "";
        friendlyMessage = `You have hit your ChatGPT usage limit${plan}.${when}`.trim();
      }

      message = err.message || friendlyMessage || message;
    }
  } catch {
    // Not JSON, use raw text
  }

  return { message, friendlyMessage };
}

function toAppError(error: unknown): AppError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("usage limit") || msg.includes("rate limit")) {
      return {
        code: "ai_rate_limit",
        message: error.message,
        cause: error,
      };
    }

    if (msg.includes("abort")) {
      return {
        code: "ai_aborted",
        message: "Request was aborted",
        cause: error,
      };
    }

    return {
      code: "ai_unknown",
      message: error.message,
      cause: error,
    };
  }

  return {
    code: "ai_unknown",
    message: String(error),
    cause: error,
  };
}

// =============================================================================
// Stream Parsing
// =============================================================================

async function* parseEventStream(stream: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
  const parser = new SSEParser();
  const functionCallInfo = new Map<string, FunctionCallInfo>();

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const events = parser.parse(chunk);

      for (const event of events) {
        yield* handleSseEvent(event, functionCallInfo);
      }
    }

    // Process remaining buffer
    const remaining = parser.flush();
    for (const event of remaining) {
      yield* handleSseEvent(event, functionCallInfo);
    }
  } finally {
    reader.releaseLock();
  }
}

class SSEParser {
  private buffer = "";

  parse(chunk: string): Array<Record<string, unknown>> {
    this.buffer += chunk;
    const events: Array<Record<string, unknown>> = [];

    let idx = this.buffer.indexOf("\n\n");
    while (idx !== -1) {
      const eventData = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);

      const event = this.parseEvent(eventData);
      if (event) {
        events.push(event);
      }

      idx = this.buffer.indexOf("\n\n");
    }

    return events;
  }

  flush(): Array<Record<string, unknown>> {
    const events: Array<Record<string, unknown>> = [];

    if (this.buffer.trim()) {
      const event = this.parseEvent(this.buffer);
      if (event) {
        events.push(event);
      }
    }

    this.buffer = "";
    return events;
  }

  private parseEvent(data: string): Record<string, unknown> | null {
    const lines = data.split("\n");
    let eventData = "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        eventData = line.slice(5).trim();
      }
    }

    if (!eventData || eventData === "[DONE]") {
      return null;
    }

    try {
      return JSON.parse(eventData) as Record<string, unknown>;
    } catch {
      log.warn("Failed to parse SSE data", { data: eventData });
      return null;
    }
  }
}

function* handleSseEvent(
  event: Record<string, unknown>,
  functionCallInfo: Map<string, FunctionCallInfo>,
): Generator<StreamEvent> {
  const eventType = event.type;

  if (typeof eventType !== "string") return;

  switch (eventType) {
    case "response.output_text.delta": {
      const delta = event.delta;
      if (typeof delta === "string") {
        yield { type: "text-delta", text: delta };
      }
      break;
    }

    case "response.output_item.added":
    case "response.output_item.done": {
      const item = event.item;
      if (isFunctionCallItem(item)) {
        const itemId = String(item.id ?? "");
        const name = String(item.name ?? "unknown");
        const callId = String(item.call_id ?? "");
        if (itemId) {
          functionCallInfo.set(itemId, { name, callId });
        }
      }
      break;
    }

    case "response.function_call_arguments.delta": {
      const delta = event.delta;
      const itemId = String(event.item_id ?? "unknown");
      const info = functionCallInfo.get(itemId);

      if (typeof delta === "string") {
        yield {
          type: "tool-input-delta",
          id: info?.callId ?? itemId,
          delta,
        };
      }
      break;
    }

    case "response.function_call_arguments.done": {
      const itemId = String(event.item_id ?? "unknown");
      const info = functionCallInfo.get(itemId);
      const name = info?.name ?? "unknown";
      const callId = info?.callId ?? itemId;
      const args = String(event.arguments ?? "{}");

      try {
        const parsedArgs = JSON.parse(args) as Record<string, unknown>;
        yield {
          type: "tool-call",
          id: callId,
          name,
          args: parsedArgs,
        };
      } catch {
        yield {
          type: "tool-call",
          id: callId,
          name,
          args: {},
        };
      }
      break;
    }

    case "response.completed": {
      yield { type: "finish", finishReason: "stop" };
      break;
    }

    case "error": {
      const message = typeof event.message === "string" ? event.message : "unknown";
      yield {
        type: "error",
        error: { code: "ai_stream_error", message },
      };
      break;
    }
  }
}

function isFunctionCallItem(item: unknown): item is { id: string; name: string; call_id: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as Record<string, unknown>).type === "function_call"
  );
}

// =============================================================================
// Message Conversion
// =============================================================================

function convertMessages(messages: AIMessage[]): CodexInputItem[] {
  const items: CodexInputItem[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "user": {
        items.push({
          role: "user",
          content: [{ type: "input_text", text: extractText(msg.content) }],
        });
        break;
      }

      case "assistant": {
        const content = msg.content;

        if (Array.isArray(content)) {
          const toolCalls = content.filter((c) => c.type === "tool-call");
          const textParts = content.filter((c) => c.type === "text");

          if (textParts.length > 0) {
            const text = textParts.map((p) => (p as { text: string }).text).join("");
            items.push({ role: "assistant", content: [{ type: "output_text", text }] });
          }

          for (const tc of toolCalls) {
            if (tc.type === "tool-call") {
              items.push({
                type: "function_call",
                call_id: tc.id,
                name: tc.name,
                arguments: JSON.stringify(tc.args),
              });
            }
          }
        } else {
          items.push({
            role: "assistant",
            content: [{ type: "output_text", text: extractText(content) }],
          });
        }
        break;
      }

      case "tool": {
        items.push({
          type: "function_call_output",
          call_id: msg.toolCallId,
          output: msg.result,
        });
        break;
      }
    }
  }

  return items;
}

function extractText(content: string | unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (isTextPart(part)) {
          return String(part.text ?? "");
        }
        return "";
      })
      .join("");
  }

  return String(content ?? "");
}

function isTextPart(part: unknown): part is { text: string } {
  return typeof part === "object" && part !== null && "text" in part;
}

// =============================================================================
// Tool Conversion
// =============================================================================

function convertTools(tools: ToolDefinition[]): CodexTool[] {
  return tools
    .filter((t) => {
      if (!t.name?.trim()) {
        log.warn("Skipping tool with missing name", t);
        return false;
      }
      return true;
    })
    .map((t) => ({
      type: "function" as const,
      name: t.name,
      description: t.description ?? "",
      parameters: t.parameters ?? { type: "object", properties: {} },
      strict: false,
    }));
}

// =============================================================================
// Utilities
// =============================================================================

function extractAccountIdFromJwt(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return "";
    const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>;
    const authClaim = payload[JWT_CLAIM_PATH] as Record<string, string> | undefined;
    return authClaim?.["user_id"] ?? (payload.sub as string) ?? "";
  } catch {
    return "";
  }
}

function isRetryable(status: number, body: string): boolean {
  return (
    status === 429 ||
    status >= 500 ||
    body.includes("rate limit") ||
    /overloaded|service.?unavailable|upstream.?connect|connection.?refused/i.test(body)
  );
}

function delay(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Request was aborted"));
    };

    if (abortSignal?.aborted) {
      onAbort();
      return;
    }

    abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
