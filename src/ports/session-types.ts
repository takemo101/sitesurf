import type { AIMessage, TokenUsage } from "@/ports/ai-provider";

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  model: string;
  messages: ChatMessage[];
  history: AIMessage[];
  summary?: ConversationSummary;
}

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  lastModified: string;
  messageCount: number;
  modelId: string;
  preview: string;
}

export interface ConversationSummary {
  text: string;
  compressedAt: number;
  originalMessageCount: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "error" | "navigation";
  content: string;
  timestamp: number;
  image?: string;
  url?: string;
  favicon?: string;
  errorCode?: string;
  toolCalls?: ToolCallInfo[];
  reasoning?: string;
  usage?: TokenUsage;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  success?: boolean;
  isRunning: boolean;
  inputDelta?: string;
}
