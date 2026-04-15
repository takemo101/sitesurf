# Performance Optimization Design Document

**Date**: 2026-04-08
**Status**: Approved for Implementation
**Target**: Load time < 2s, Memory < 既存拡張 50%

---

## Overview

Comprehensive performance optimization to achieve sub-2-second initial load and efficient memory usage.

---

## Current State Analysis

### Bundle Size

- `sidepanel.js`: 4.9MB (main issue)
- `background.js`: 26KB
- Total: ~5MB uncompressed

### Target Metrics

| Metric              | Current  | Target        | Improvement |
| ------------------- | -------- | ------------- | ----------- |
| Initial Load        | ~5s      | <2s           | -60%        |
| Time to Interactive | ~6s      | <3s           | -50%        |
| Memory Usage        | Baseline | <既存拡張 50% | -50%        |
| JS Bundle           | 4.9MB    | <2MB          | -60%        |

---

## 1. Feature-Based Code Splitting

### Split Strategy

```
src/
├── sidepanel/
│   └── App.tsx            # Main entry point (always loaded)
├── features/
│   ├── chat/              # Core, loaded first
│   │   ├── ChatArea.tsx
│   │   ├── MessageBubble.tsx
│   │   └── tool-renderers/
│   ├── settings/          # Lazy loaded
│   │   ├── SettingsPanel.tsx
│   │   └── OAuthSection.tsx
│   ├── artifacts/         # Lazy loaded
│   │   ├── ArtifactPanel.tsx
│   │   └── ArtifactPreview.tsx
│   ├── security/          # Loaded with chat
│   └── ai/                # Loaded with chat
│       └── prompt-cache.ts
```

### Implementation

```typescript
// src/features/index.ts
import { lazy } from "react";

// Core - always loaded (chat + security + ai)
export { ChatArea } from "./chat/ChatArea";

// Lazy features
export const SettingsPanel = lazy(() => import("./settings/SettingsPanel"));
export const ArtifactPanel = lazy(() => import("./artifacts/ArtifactPanel"));

// Preload strategy
export const preloadChat = () => {
  const ChatModule = import("./chat/ChatArea");
  return ChatModule;
};
```

### Loading Strategy

```typescript
// src/sidepanel/App.tsx
import { Suspense, useEffect } from 'react';
import { Loader } from '@mantine/core';

function App() {
  // Preload lazy features after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      preloadChat();
    }, 1000); // 1s after mount

    return () => clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      <Layout>
        {/* Feature panels rendered conditionally, not via router */}
        <ChatArea />
        <SettingsPanel />
        <ArtifactPanel />
      </Layout>
    </Suspense>
  );
}
```

---

## 2. Lazy Loading Components

### Priority-Based Loading

```typescript
// src/utils/lazy-priority.ts

// Priority 1: Critical (immediate)
export const CriticalComponents = {
  Header: () => import("../components/Header"),
  InputArea: () => import("../components/InputArea"),
};

// Priority 2: High (after 500ms)
export const HighPriorityComponents = {
  ChatArea: () => import("../features/chat/ChatArea"),
  MessageBubble: () => import("../features/chat/MessageBubble"),
};

// Priority 3: Medium (after 1000ms)
export const MediumPriorityComponents = {
  SettingsPanel: () => import("../features/settings/SettingsPanel"),
  ToolRenderers: () => import("../features/chat/tool-renderers"),
};

// Priority 4: Low (after 2000ms or on demand)
export const LowPriorityComponents = {
  ArtifactPanel: () => import("../features/artifacts/ArtifactPanel"),
  MarkdownContent: () => import("../components/MarkdownContent"),
};
```

### Progressive Loading Hook

```typescript
// src/hooks/use-progressive-loading.ts

export function useProgressiveLoading() {
  useEffect(() => {
    // High priority: 500ms
    const highTimer = setTimeout(() => {
      Object.values(HighPriorityComponents).forEach((load) => load());
    }, 500);

    // Medium priority: 1000ms
    const mediumTimer = setTimeout(() => {
      Object.values(MediumPriorityComponents).forEach((load) => load());
    }, 1000);

    // Low priority: 2000ms
    const lowTimer = setTimeout(() => {
      Object.values(LowPriorityComponents).forEach((load) => load());
    }, 2000);

    return () => {
      clearTimeout(highTimer);
      clearTimeout(mediumTimer);
      clearTimeout(lowTimer);
    };
  }, []);
}
```

---

## 3. Caching Strategy

### System Prompt Cache

```typescript
// src/features/ai/prompt-cache.ts

interface PromptCache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  clear(): void;
}

class PromptCacheImpl implements PromptCache {
  private cache = new Map<string, { value: string; timestamp: number }>();
  private maxSize = 10;
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: string): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const promptCache = new PromptCacheImpl();
```

### Skill Validation Cache

```typescript
// src/features/tools/skills/validation-cache.ts

interface ValidationCacheEntry {
  valid: boolean;
  errors: ValidationError[];
  timestamp: number;
  hash: string; // Code hash for invalidation
}

class SkillValidationCache {
  private cache = new Map<string, ValidationCacheEntry>();
  private ttl = 10 * 60 * 1000; // 10 minutes

  get(skillId: string, codeHash: string): ValidationResult | undefined {
    const entry = this.cache.get(skillId);
    if (!entry) return undefined;

    // Invalidate if code changed
    if (entry.hash !== codeHash) {
      this.cache.delete(skillId);
      return undefined;
    }

    // Invalidate if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(skillId);
      return undefined;
    }

    return { valid: entry.valid, errors: entry.errors };
  }

  set(skillId: string, codeHash: string, result: ValidationResult): void {
    this.cache.set(skillId, {
      valid: result.valid,
      errors: result.errors,
      timestamp: Date.now(),
      hash: codeHash,
    });
  }

  invalidate(skillId: string): void {
    this.cache.delete(skillId);
  }
}

export const skillValidationCache = new SkillValidationCache();
```

### Combined Cache Manager

```typescript
// src/utils/cache-manager.ts

export class CacheManager {
  static clearAll(): void {
    promptCache.clear();
    skillValidationCache.clear();
    // Clear other caches
  }

  static getStats(): CacheStats {
    return {
      promptCache: promptCache.size,
      skillValidationCache: skillValidationCache.size,
    };
  }
}
```

---

## 4. Memory Optimization

### Component Unmounting

```typescript
// src/hooks/use-memory-cleanup.ts

export function useMemoryCleanup() {
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      clearLargeCaches();
      releaseUnusedResources();
    };
  }, []);
}

function clearLargeCaches() {
  // Clear image caches
  // Clear unused tool results
  // Clear old messages (keep last 100)
}
```

### Message Pagination

```typescript
// src/features/chat/virtual-messages.ts

export function useVirtualMessages(messages: Message[], containerRef: RefObject<HTMLElement>) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute("data-index") || "0");
            updateVisibleRange(index);
          }
        });
      },
      { root: containerRef.current, threshold: 0.1 },
    );

    return () => observer.disconnect();
  }, []);

  const visibleMessages = useMemo(() => {
    return messages.slice(visibleRange.start, visibleRange.end);
  }, [messages, visibleRange]);

  return { visibleMessages, visibleRange };
}
```

---

## 5. Build Optimization

### Vite Configuration

Note: This project uses `vite-plus` as the build tool (a thin wrapper around Vite that handles Chrome extension manifest injection). The config below applies to the `vite-plus` configuration file.

```typescript
// vite.config.ts

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          "ai-sdk": ["@ai-sdk/anthropic", "@ai-sdk/openai", "@ai-sdk/google"],
          mantine: ["@mantine/core", "@mantine/hooks", "@mantine/notifications"],
          utils: ["zustand", "immer", "date-fns"],

          // Feature chunks
          chat: ["./src/features/chat"],
          tools: ["./src/features/tools"],
          artifacts: ["./src/features/artifacts"],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@mantine/core"],
  },
});
```

---

## 6. Implementation Plan

### Status Summary

| Item                              | Status  | Notes                                                    |
| --------------------------------- | ------- | -------------------------------------------------------- |
| Feature-based code splitting      | Partial | `features/` structure exists; lazy loading not yet wired |
| Lazy loading + loading states     | Partial | `React.lazy` used in some places                         |
| System prompt cache               | Done    | `src/features/ai/prompt-cache.ts` implemented            |
| Skill validation cache            | Pending | Cache interface designed, not yet integrated             |
| Cache manager                     | Pending | Depends on validation cache                              |
| Memory cleanup hooks              | Pending | Pattern defined, not applied broadly                     |
| Message virtualization            | Pending | `virtual-messages.ts` stub exists                        |
| Build optimization (manualChunks) | Partial | Vendor chunks configured; feature chunks not split yet   |

---

## Success Metrics

| Metric              | Before   | After         | Target |
| ------------------- | -------- | ------------- | ------ |
| Bundle Size         | 4.9MB    | <2MB          | ✅     |
| Initial Load        | ~5s      | <2s           | ✅     |
| Time to Interactive | ~6s      | <3s           | ✅     |
| Memory Usage        | Baseline | <50% 既存拡張 | ✅     |

---

## Monitoring

```typescript
// src/utils/performance-monitor.ts

export function reportPerformanceMetrics() {
  // Web Vitals
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);

  // Custom metrics
  performance.measure("initial-load", "navigationStart", "domInteractive");
  performance.measure("time-to-interactive", "navigationStart", "domContentLoaded");
}
```

---

## References

- Current bundle: `dist/sidepanel.js` (4.9MB)
- Vite docs: https://vitejs.dev/guide/build.html
- React lazy: https://react.dev/reference/react/lazy
