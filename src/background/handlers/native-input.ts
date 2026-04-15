import type {
  NativeInputMessage,
  NativeInputResponse,
  NativeInputScrollOptions,
} from "@/shared/message-types";

interface KeyInfo {
  key: string;
  code: string;
  windowsVirtualKeyCode: number;
}

interface DebuggerResult {
  result?: {
    value?: unknown;
  };
}

// Delay between clicks for double click detection (milliseconds)
// Must be within system double-click threshold (typically 200-500ms)
const DOUBLE_CLICK_DELAY = 100;

/**
 * Handles native input events via Chrome Debugger API
 * Generates isTrusted: true events for bot-resistant sites
 */
export class NativeInputHandler {
  private modifiers = 0;
  private readonly MODIFIER_ALT = 1;
  private readonly MODIFIER_CTRL = 2;
  private readonly MODIFIER_META = 4;
  private readonly MODIFIER_SHIFT = 8;

  async click(
    tabId: number,
    selector: string,
    options?: NativeInputMessage["options"],
  ): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const coords = await this.getElementCoordinates(tabId, selector);
      if (!coords) {
        throw new Error(`Element not found: ${selector}`);
      }

      const x = coords.x + (options?.offsetX ?? coords.width / 2);
      const y = coords.y + (options?.offsetY ?? coords.height / 2);
      const button = this.mapButton(options?.button ?? "left");

      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button,
        clickCount: 1,
      });

      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button,
        clickCount: 1,
      });
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async doubleClick(tabId: number, selector: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const coords = await this.getElementCoordinates(tabId, selector);
      if (!coords) {
        throw new Error(`Element not found: ${selector}`);
      }

      const x = coords.x + coords.width / 2;
      const y = coords.y + coords.height / 2;

      // First click
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      });

      // Delay for double-click detection
      await this.sleep(DOUBLE_CLICK_DELAY);

      // Second click
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 2,
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 2,
      });
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async rightClick(tabId: number, selector: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const coords = await this.getElementCoordinates(tabId, selector);
      if (!coords) {
        throw new Error(`Element not found: ${selector}`);
      }

      const x = coords.x + coords.width / 2;
      const y = coords.y + coords.height / 2;

      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "right",
        clickCount: 1,
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button: "right",
        clickCount: 1,
      });
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async hover(tabId: number, selector: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const coords = await this.getElementCoordinates(tabId, selector);
      if (!coords) {
        throw new Error(`Element not found: ${selector}`);
      }

      const x = coords.x + coords.width / 2;
      const y = coords.y + coords.height / 2;

      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x,
        y,
      });
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async focus(tabId: number, selector: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const result = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression: `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.focus();
            el.scrollIntoView({ block: "nearest" });
            return true;
          }
          return false;
        })()
      `,
        returnByValue: true,
      })) as DebuggerResult;

      if (result.result?.value !== true) {
        throw new Error(`Element not found: ${selector}`);
      }
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async blur(tabId: number, selector?: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const expression = selector
        ? `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el && el.blur) {
            el.blur();
            return true;
          }
          return false;
        })()
      `
        : `
        (() => {
          const el = document.activeElement;
          if (el && el.blur) {
            el.blur();
            return true;
          }
          return false;
        })()
      `;

      const result = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression,
        returnByValue: true,
      })) as DebuggerResult;

      if (result.result?.value !== true) {
        throw new Error(selector ? `Element not found: ${selector}` : "No active element to blur");
      }
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async scroll(tabId: number, selector: string, options?: NativeInputScrollOptions): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const result = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression: `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.scrollIntoView({
              behavior: ${JSON.stringify(options?.behavior ?? "auto")},
              block: ${JSON.stringify(options?.block ?? "nearest")}
            });
            return true;
          }
          return false;
        })()
      `,
        returnByValue: true,
      })) as DebuggerResult;

      if (result.result?.value !== true) {
        throw new Error(`Element not found: ${selector}`);
      }
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async selectText(tabId: number, selector: string, start?: number, end?: number): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      if (start !== undefined && end !== undefined) {
        // Range selection using setSelectionRange
        const result = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
          expression: `
            (() => {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (el && el.setSelectionRange) {
                el.setSelectionRange(${start}, ${end});
                el.focus();
                return true;
              }
              return false;
            })()
          `,
          returnByValue: true,
        })) as DebuggerResult;

        if (result.result?.value !== true) {
          throw new Error(`Element does not support setSelectionRange: ${selector}`);
        }
      } else {
        // Use JavaScript Selection API for full text selection
        const result = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
          expression: `
            (() => {
              const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return false;
              
              // For input/textarea elements
              if (el.setSelectionRange) {
                el.focus();
                el.setSelectionRange(0, el.value?.length || 0);
                return true;
              }
              
              // For other elements, use Selection API
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(el);
              selection.removeAllRanges();
              selection.addRange(range);
              return true;
            })()
          `,
          returnByValue: true,
        })) as DebuggerResult;

        if (result.result?.value !== true) {
          throw new Error(`Failed to select text: ${selector}`);
        }
      }
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async type(tabId: number, selector: string, text: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      // Focus element first
      const focusResult = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression: `
          (() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (el) {
              el.focus();
              el.scrollIntoView({ block: "nearest" });
              return true;
            }
            return false;
          })()
        `,
        returnByValue: true,
      })) as DebuggerResult;

      if (focusResult.result?.value !== true) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Type each character with text parameter on keyDown only
      // CDP's text parameter ensures proper character input (React, etc.)
      for (const char of text) {
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
          type: "keyDown",
          text: char,
        });
        // keyUp doesn't need text parameter
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
          type: "keyUp",
        });
      }
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async press(tabId: number, key: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const keyInfo = this.getKeyInfo(key);

      // Update modifier state BEFORE dispatching event
      if (this.isModifierKey(key)) {
        this.updateModifierState(key, true);
      }

      await this.dispatchKeyEvent(tabId, keyInfo, true);
      await this.dispatchKeyEvent(tabId, keyInfo, false);

      // Update modifier state AFTER dispatching event
      if (this.isModifierKey(key)) {
        this.updateModifierState(key, false);
      }
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async keyDown(tabId: number, key: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const keyInfo = this.getKeyInfo(key);

      // Update modifier state BEFORE dispatching event
      if (this.isModifierKey(key)) {
        this.updateModifierState(key, true);
      }

      await this.dispatchKeyEvent(tabId, keyInfo, true);
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  async keyUp(tabId: number, key: string): Promise<void> {
    try {
      await this.attachDebugger(tabId);

      const keyInfo = this.getKeyInfo(key);

      await this.dispatchKeyEvent(tabId, keyInfo, false);

      // Update modifier state AFTER dispatching event
      if (this.isModifierKey(key)) {
        this.updateModifierState(key, false);
      }
    } finally {
      await this.detachDebugger(tabId);
    }
  }

  private async attachDebugger(tabId: number): Promise<void> {
    try {
      await chrome.debugger.attach({ tabId }, "1.3");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already attached")) {
        return;
      }
      throw err;
    }
  }

  private async detachDebugger(tabId: number): Promise<void> {
    try {
      await chrome.debugger.detach({ tabId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not attached")) {
        return;
      }
      throw err;
    }
  }

  private async getElementCoordinates(
    tabId: number,
    selector: string,
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    const result = (await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
      expression: `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height
          };
        })()
      `,
      returnByValue: true,
    })) as DebuggerResult;

    return (
      (result.result?.value as { x: number; y: number; width: number; height: number }) ?? null
    );
  }

  private mapButton(button: "left" | "right" | "middle"): "left" | "right" | "middle" {
    return button;
  }

  private isModifierKey(key: string): boolean {
    return key === "Alt" || key === "Control" || key === "Meta" || key === "Shift";
  }

  private getKeyInfo(key: string): KeyInfo {
    const keyMap: Record<string, KeyInfo> = {
      // Navigation keys
      Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
      Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
      Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
      Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
      Delete: { key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 },
      Insert: { key: "Insert", code: "Insert", windowsVirtualKeyCode: 45 },
      Home: { key: "Home", code: "Home", windowsVirtualKeyCode: 36 },
      End: { key: "End", code: "End", windowsVirtualKeyCode: 35 },
      PageUp: { key: "PageUp", code: "PageUp", windowsVirtualKeyCode: 33 },
      PageDown: { key: "PageDown", code: "PageDown", windowsVirtualKeyCode: 34 },

      // Arrow keys
      ArrowUp: { key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 },
      ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 },
      ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 },
      ArrowRight: { key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 },

      // Modifier keys
      Alt: { key: "Alt", code: "AltLeft", windowsVirtualKeyCode: 18 },
      Control: { key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17 },
      Shift: { key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 },
      Meta: { key: "Meta", code: "MetaLeft", windowsVirtualKeyCode: 91 },

      // Special keys
      Space: { key: " ", code: "Space", windowsVirtualKeyCode: 32 },

      // Function keys
      F1: { key: "F1", code: "F1", windowsVirtualKeyCode: 112 },
      F2: { key: "F2", code: "F2", windowsVirtualKeyCode: 113 },
      F3: { key: "F3", code: "F3", windowsVirtualKeyCode: 114 },
      F4: { key: "F4", code: "F4", windowsVirtualKeyCode: 115 },
      F5: { key: "F5", code: "F5", windowsVirtualKeyCode: 116 },
      F6: { key: "F6", code: "F6", windowsVirtualKeyCode: 117 },
      F7: { key: "F7", code: "F7", windowsVirtualKeyCode: 118 },
      F8: { key: "F8", code: "F8", windowsVirtualKeyCode: 119 },
      F9: { key: "F9", code: "F9", windowsVirtualKeyCode: 120 },
      F10: { key: "F10", code: "F10", windowsVirtualKeyCode: 121 },
      F11: { key: "F11", code: "F11", windowsVirtualKeyCode: 122 },
      F12: { key: "F12", code: "F12", windowsVirtualKeyCode: 123 },
    };

    // Handle single letters and digits
    if (key.length === 1) {
      const upper = key.toUpperCase();
      const isLetter = upper >= "A" && upper <= "Z";
      const isDigit = key >= "0" && key <= "9";

      if (isLetter) {
        return {
          key,
          code: `Key${upper}`,
          windowsVirtualKeyCode: upper.charCodeAt(0),
        };
      }

      if (isDigit) {
        return {
          key,
          code: `Digit${key}`,
          windowsVirtualKeyCode: key.charCodeAt(0),
        };
      }
    }

    const mapped = keyMap[key];
    if (mapped) return mapped;

    throw new Error(`Unknown key: ${key}`);
  }

  private async dispatchKeyEvent(tabId: number, keyInfo: KeyInfo, isDown: boolean): Promise<void> {
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: isDown ? "keyDown" : "keyUp",
      key: keyInfo.key,
      code: keyInfo.code,
      windowsVirtualKeyCode: keyInfo.windowsVirtualKeyCode,
      modifiers: this.modifiers,
    });
  }

  private updateModifierState(key: string, isDown: boolean): void {
    const bit = this.getModifierBit(key);
    if (bit === 0) return;

    if (isDown) {
      this.modifiers |= bit;
    } else {
      this.modifiers &= ~bit;
    }
  }

  private getModifierBit(key: string): number {
    switch (key) {
      case "Alt":
        return this.MODIFIER_ALT;
      case "Control":
        return this.MODIFIER_CTRL;
      case "Meta":
        return this.MODIFIER_META;
      case "Shift":
        return this.MODIFIER_SHIFT;
      default:
        return 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const nativeInputHandler = new NativeInputHandler();

async function handleNativeInput(msg: NativeInputMessage): Promise<NativeInputResponse> {
  const tabId = msg.tabId;

  try {
    switch (msg.action) {
      case "click": {
        if (!msg.selector) {
          return { success: false, error: "selector required for click" };
        }
        await nativeInputHandler.click(tabId, msg.selector, msg.options);
        break;
      }
      case "doubleClick": {
        if (!msg.selector) {
          return { success: false, error: "selector required for doubleClick" };
        }
        await nativeInputHandler.doubleClick(tabId, msg.selector);
        break;
      }
      case "rightClick": {
        if (!msg.selector) {
          return { success: false, error: "selector required for rightClick" };
        }
        await nativeInputHandler.rightClick(tabId, msg.selector);
        break;
      }
      case "hover": {
        if (!msg.selector) {
          return { success: false, error: "selector required for hover" };
        }
        await nativeInputHandler.hover(tabId, msg.selector);
        break;
      }
      case "focus": {
        if (!msg.selector) {
          return { success: false, error: "selector required for focus" };
        }
        await nativeInputHandler.focus(tabId, msg.selector);
        break;
      }
      case "blur": {
        await nativeInputHandler.blur(tabId, msg.selector);
        break;
      }
      case "scroll": {
        if (!msg.selector) {
          return { success: false, error: "selector required for scroll" };
        }
        await nativeInputHandler.scroll(tabId, msg.selector, msg.scrollOptions);
        break;
      }
      case "selectText": {
        if (!msg.selector) {
          return { success: false, error: "selector required for selectText" };
        }
        await nativeInputHandler.selectText(tabId, msg.selector, msg.start, msg.end);
        break;
      }
      case "type": {
        if (!msg.selector || msg.text === undefined) {
          return { success: false, error: "selector and text required for type" };
        }
        await nativeInputHandler.type(tabId, msg.selector, msg.text);
        break;
      }
      case "press": {
        if (!msg.key) {
          return { success: false, error: "key required for press" };
        }
        await nativeInputHandler.press(tabId, msg.key);
        break;
      }
      case "keyDown": {
        if (!msg.key) {
          return { success: false, error: "key required for keyDown" };
        }
        await nativeInputHandler.keyDown(tabId, msg.key);
        break;
      }
      case "keyUp": {
        if (!msg.key) {
          return { success: false, error: "key required for keyUp" };
        }
        await nativeInputHandler.keyUp(tabId, msg.key);
        break;
      }
      default: {
        return { success: false, error: `Unknown action: ${(msg as { action: string }).action}` };
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SiteSurf:native-input] Native input error`, {
      action: msg.action,
      error: message,
    });
    return { success: false, error: message };
  }
}

// Message handler registration
chrome.runtime.onMessage.addListener(
  (msg: NativeInputMessage, _sender, sendResponse: (response: NativeInputResponse) => void) => {
    if (msg.type === "BG_NATIVE_INPUT") {
      handleNativeInput(msg)
        .then(sendResponse)
        .catch((err) =>
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      return true; // async
    }
    return false;
  },
);
