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
