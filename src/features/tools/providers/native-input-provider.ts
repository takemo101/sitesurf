import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";
import type {
  NativeInputMessage,
  NativeInputResponse,
  NativeInputScrollOptions,
  NativeInputClickOptions,
} from "@/shared/message-types";

/**
 * NativeInputProvider - Native Input Functions の提供
 *
 * Chrome debugger protocolを使用した信頼性の高いブラウザイベントを提供する。
 */
export class NativeInputProvider implements RuntimeProvider {
  readonly actions = [
    "nativeClick",
    "nativeDoubleClick",
    "nativeRightClick",
    "nativeHover",
    "nativeFocus",
    "nativeBlur",
    "nativeScroll",
    "nativeSelectText",
    "nativeType",
    "nativePress",
    "nativeKeyDown",
    "nativeKeyUp",
  ] as const;

  getDescription(): string {
    return `## Native Input Functions (REQUIRED for interactions)

Dispatch trusted browser events (isTrusted: true) that work reliably on all sites.

### When to Use
- **ALWAYS** for clicking elements (buttons, links, checkboxes)
- **ALWAYS** for typing text into inputs and textareas
- **ALWAYS** for pressing keys (Enter, Tab, Escape, etc.)
- **ALWAYS** for form submissions

### Do NOT Use browserjs() For
- Clicking elements - use nativeClick()
- Typing text - use nativeType()
- Pressing keys - use nativePress()
- Form submissions - use nativeClick() on the submit button

### Mouse Actions
- \`await nativeClick(selector, options?)\` - Click an element
  - options: { button?: "left" | "right" | "middle", offsetX?: number, offsetY?: number }
- \`await nativeDoubleClick(selector)\` - Double-click an element
- \`await nativeRightClick(selector)\` - Right-click (context menu)
- \`await nativeHover(selector)\` - Move mouse over element

### Keyboard Actions
- \`await nativeType(selector, text)\` - Type text into an input/textarea
- \`await nativePress(key)\` - Press and release a key (Enter, Tab, Escape, ArrowUp, etc.)
- \`await nativeKeyDown(key)\` - Hold a key down (for modifier combinations)
- \`await nativeKeyUp(key)\` - Release a held key

### Focus Actions
- \`await nativeFocus(selector)\` - Focus an element without clicking
- \`await nativeBlur(selector?)\` - Remove focus (uses activeElement if selector omitted)

### Scroll & Selection
- \`await nativeScroll(selector, options?)\` - Scroll element into view
  - options: { behavior?: "auto" | "smooth", block?: "start" | "center" | "end" | "nearest" }
- \`await nativeSelectText(selector, start?, end?)\` - Select text
  - Omit start/end to select all text

### Examples
\`\`\`javascript
// ✅ CORRECT: Form submission with native functions
await nativeType('input[name="username"]', 'john_doe');
await nativeType('input[name="password"]', 'secret123');
await nativeClick('button[type="submit"]');

// ❌ WRONG: Using browserjs for interactions
await browserjs(() => {
  document.querySelector('input[name="username"]').value = 'john_doe';
  document.querySelector('button[type="submit"]').click();
});

// ✅ CORRECT: Right-click context menu
await nativeRightClick('.file-item');

// ✅ CORRECT: Double-click to edit
await nativeDoubleClick('.editable-title');

// ✅ CORRECT: Hover to reveal menu, then click
await nativeHover('.dropdown-trigger');
await nativeClick('.dropdown-item');

// ✅ CORRECT: Keyboard shortcuts
await nativeKeyDown('Control');
await nativePress('a');  // Select all
await nativeKeyUp('Control');

// ✅ CORRECT: Focus, type, and blur for validation
await nativeFocus('input#email');
await nativeType('input#email', 'test@example.com');
await nativeBlur();  // Triggers validation

// ✅ CORRECT: Scroll to element
await nativeScroll('.target-section', { behavior: 'smooth', block: 'center' });
\`\`\``;
  }

  getRuntimeCode(): string {
    const actions = [
      "nativeClick",
      "nativeDoubleClick",
      "nativeRightClick",
      "nativeHover",
      "nativeFocus",
      "nativeBlur",
      "nativeScroll",
      "nativeSelectText",
      "nativeType",
      "nativePress",
      "nativeKeyDown",
      "nativeKeyUp",
    ];

    return actions
      .map((action) => {
        const isGlobal =
          action === "nativePress" || action === "nativeKeyDown" || action === "nativeKeyUp";
        if (isGlobal) {
          return `
function ${action}(key) {
  return new Promise((resolve, reject) => {
    const id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const handler = (event) => {
      if (event.data?.type === 'sandbox-response' && event.data.id === id) {
        window.removeEventListener('message', handler);
        if (event.data.ok) {
          resolve(event.data.value);
        } else {
          reject(new Error(event.data.error));
        }
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'sandbox-request', id, action: '${action}', key }, '*');
  });
}`;
        } else {
          return `
function ${action}(selector, ...args) {
  return new Promise((resolve, reject) => {
    const id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const handler = (event) => {
      if (event.data?.type === 'sandbox-response' && event.data.id === id) {
        window.removeEventListener('message', handler);
        if (event.data.ok) {
          resolve(event.data.value);
        } else {
          reject(new Error(event.data.error));
        }
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'sandbox-request', id, action: '${action}', selector, args }, '*');
  });
}`;
        }
      })
      .join("\n");
  }

  async handleRequest(
    request: SandboxRequest,
    context: ProviderContext,
  ): Promise<Result<unknown, ToolError>> {
    const { browser } = context;
    const { action } = request;

    try {
      const tab = await browser.getActiveTab();
      if (tab.id === null) {
        return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
      }

      const params = this.buildNativeInputParams(action, request, tab.id);
      const result = await chrome.runtime.sendMessage<NativeInputMessage, NativeInputResponse>(
        params,
      );

      if (!result?.success) {
        return err({
          code: "tool_script_error",
          message: result?.error ?? "Native input failed",
        });
      }

      return ok(result);
    } catch (e: unknown) {
      return err({
        code: "tool_script_error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private buildNativeInputParams(
    action: string,
    request: SandboxRequest,
    tabId: number,
  ): NativeInputMessage {
    const { selector, key, text, args } = request as unknown as {
      selector?: string;
      key?: string;
      text?: string;
      args?: unknown[];
    };

    const baseParams = {
      type: "BG_NATIVE_INPUT" as const,
      tabId,
    };

    switch (action) {
      case "nativeClick": {
        const [options] = args || [];
        return {
          ...baseParams,
          action: "click",
          selector,
          options: options as NativeInputClickOptions | undefined,
        };
      }

      case "nativeDoubleClick":
        return {
          ...baseParams,
          action: "doubleClick",
          selector,
        };

      case "nativeRightClick":
        return {
          ...baseParams,
          action: "rightClick",
          selector,
        };

      case "nativeHover":
        return {
          ...baseParams,
          action: "hover",
          selector,
        };

      case "nativeFocus":
        return {
          ...baseParams,
          action: "focus",
          selector,
        };

      case "nativeBlur":
        return {
          ...baseParams,
          action: "blur",
          selector,
        };

      case "nativeScroll": {
        const [scrollOptions] = args || [];
        return {
          ...baseParams,
          action: "scroll",
          selector,
          scrollOptions: scrollOptions as NativeInputScrollOptions | undefined,
        };
      }

      case "nativeSelectText": {
        const [start, end] = args || [];
        return {
          ...baseParams,
          action: "selectText",
          selector,
          start: start as number | undefined,
          end: end as number | undefined,
        };
      }

      case "nativeType":
        return {
          ...baseParams,
          action: "type",
          selector,
          text,
        };

      case "nativePress":
        return {
          ...baseParams,
          action: "press",
          key,
        };

      case "nativeKeyDown":
        return {
          ...baseParams,
          action: "keyDown",
          key,
        };

      case "nativeKeyUp":
        return {
          ...baseParams,
          action: "keyUp",
          key,
        };

      default:
        throw new Error(`Unknown native input action: ${action}`);
    }
  }
}
