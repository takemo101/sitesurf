export interface NativeInputClickOptions {
  button?: "left" | "right" | "middle";
  offsetX?: number;
  offsetY?: number;
}

export interface NativeInputScrollOptions {
  behavior?: "auto" | "smooth";
  block?: "start" | "center" | "end" | "nearest";
}

export interface NativeInputMessage {
  type: "BG_NATIVE_INPUT";
  action:
    | "click"
    | "doubleClick"
    | "rightClick"
    | "focus"
    | "blur"
    | "hover"
    | "scroll"
    | "selectText"
    | "type"
    | "press"
    | "keyDown"
    | "keyUp";
  tabId: number;
  selector?: string;
  text?: string;
  key?: string;
  options?: NativeInputClickOptions;
  scrollOptions?: NativeInputScrollOptions;
  start?: number;
  end?: number;
}

export interface NativeInputResponse {
  success: boolean;
  error?: string;
}

// --- bg_fetch ---

export interface BgFetchMessage {
  type: "BG_FETCH";
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  responseType: "text" | "json" | "base64" | "readability";
  timeout: number;
}

export interface BgFetchResponse {
  success: boolean;
  data?: {
    url: string;
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string | object;
    redirected?: boolean;
    redirectUrl?: string;
  };
  error?: string;
}

// --- Readability (background → offscreen) ---

export interface ReadabilityMessage {
  type: "BG_READABILITY";
  html: string;
  url: string;
}

export interface ReadabilityResponse {
  success: boolean;
  title?: string;
  content?: string;
  links?: Array<{ text: string; href: string }>;
  error?: string;
}
