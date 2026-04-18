# Tool UI Refinement Design Document

**Date**: 2026-04-08
**Status**: Partially Implemented (実装準拠で更新)
**Target**: 既存拡張-level tool renderers with real-time feedback

---

## Overview

Redesign tool rendering system to provide specialized, polished UI for each tool type, surpassing 既存拡張's renderer quality.

### 実装スナップショット（2026-04）

現在の実装は「汎用Registry方式」ではなく、`ToolCallBlock.tsx` 内の専用レンダリングで進化している。

- 実装済み
  - REPL: コード表示（シンタックスハイライト + コピー）
  - REPL: Console/Output 折りたたみ
  - REPL: ReturnValue の JSON ツリー表示
  - navigate/read_page 等: JSON結果の構造化表示
  - extract_image: 専用プレビュー + エラー詳細表示

- 未実装 / 将来候補
  - ToolRendererRegistry の独立モジュール化
  - REPL のリアルタイム log streaming（逐次 push）
  - navigate の遷移アニメーション/計測UI

---

## Design Goals

1. **Specialized Renderers**: Each tool has optimized UI
2. **Real-time Feedback**: Live console logs, execution status
3. **Structured Output**: Better visualization of return values
4. **Extensible Architecture**: Easy to add new tool renderers

---

## Architecture

```
ToolRendererRegistry
├── ReplToolRenderer
│   ├── Real-time console log streaming
│   ├── Syntax-highlighted code display
│   └── Structured return value viewer
├── ArtifactsToolRenderer
│   ├── File operation visualization
│   ├── Diff viewer for updates
│   └── Preview mode for HTML
└── NavigateToolRenderer
    ├── Page transition animation
    ├── URL breadcrumb display
    └── Load time metrics
```

---

## 1. Tool Renderer Registry

### Core Interface

```typescript
// src/features/chat/tool-renderers/types.ts

export interface ToolRenderer<T = unknown> {
  // Render executing state
  renderExecuting(args: T): React.ReactNode;

  // Render success state
  renderSuccess(result: T, logs?: ConsoleLog[]): React.ReactNode;

  // Render error state
  renderError(error: ToolError): React.ReactNode;

  // Render collapsed summary
  renderSummary(args: T, result?: T): React.ReactNode;
}

export interface ToolRendererRegistry {
  register(toolName: string, renderer: ToolRenderer): void;
  get(toolName: string): ToolRenderer | undefined;
}
```

### Registry Implementation

```typescript
// src/features/chat/tool-renderers/registry.ts

class ToolRendererRegistryImpl implements ToolRendererRegistry {
  private renderers = new Map<string, ToolRenderer>();

  register(toolName: string, renderer: ToolRenderer): void {
    this.renderers.set(toolName, renderer);
  }

  get(toolName: string): ToolRenderer | undefined {
    return this.renderers.get(toolName);
  }
}

export const toolRendererRegistry = new ToolRendererRegistryImpl();
```

---

## 2. REPL Tool Renderer

### Features

- Real-time console log streaming
- Syntax-highlighted code display
- Structured return value viewer with JSON tree

### Implementation

```typescript
// src/features/chat/tool-renderers/ReplToolRenderer.tsx

export class ReplToolRenderer implements ToolRenderer<ReplArgs> {
  renderExecuting(args: ReplArgs) {
    return (
      <ReplExecutionCard
        title={args.title}
        code={args.code}
        status="running"
        logs={[]}
      />
    );
  }

  renderSuccess(result: ReplResult, logs?: ConsoleLog[]) {
    return (
      <ReplResultCard
        returnValue={result.returnValue}
        consoleLogs={logs || []}
        executionTime={result.duration}
        outputSize={result.outputSize}
      />
    );
  }

  renderError(error: ToolError) {
    return (
      <ReplErrorCard
        error={error}
        suggestion={this.getSuggestion(error)}
      />
    );
  }

  renderSummary(args: ReplArgs, result?: ReplResult) {
    return (
      <ReplSummary
        title={args.title}
        status={result ? 'success' : 'running'}
        lineCount={args.code.split('\n').length}
      />
    );
  }
}

// Components

function ReplExecutionCard({ title, code, status, logs }: ReplExecutionCardProps) {
  return (
    <Paper withBorder radius="md" p={0}>
      {/* Header */}
      <Group px="md" py="xs" bg="var(--mantine-color-indigo-light)">
        <Loader size={16} />
        <Text size="sm" fw={500}>{title || 'Executing...'}</Text>
        <Badge size="xs" variant="light">Running</Badge>
      </Group>

      {/* Code Preview */}
      <Box px="md" py="xs" bg="var(--mantine-color-dark-9)">
        <CodeHighlight
          code={code.slice(0, 200) + (code.length > 200 ? '...' : '')}
          language="javascript"
          maxHeight={150}
        />
      </Box>

      {/* Live Logs */}
      {logs.length > 0 && (
        <ConsoleLogViewer logs={logs} maxHeight={200} />
      )}
    </Paper>
  );
}

function ReplResultCard({ returnValue, consoleLogs, executionTime, outputSize }: ReplResultCardProps) {
  const [activeTab, setActiveTab] = useState<'result' | 'logs' | 'raw'>('result');

  return (
    <Paper withBorder radius="md" p={0}>
      {/* Header */}
      <Group px="md" py="xs" justify="space-between">
        <Group>
          <CheckCircle size={16} color="green" />
          <Text size="sm">Completed</Text>
          <Text size="xs" c="dimmed">({executionTime}ms)</Text>
        </Group>
        <SegmentedControl
          size="xs"
          value={activeTab}
          onChange={setActiveTab}
          data={[
            { label: 'Result', value: 'result' },
            { label: `Logs (${consoleLogs.length})`, value: 'logs' },
            { label: 'Raw', value: 'raw' },
          ]}
        />
      </Group>

      {/* Content */}
      <Box p="md">
        {activeTab === 'result' && (
          <StructuredValueViewer value={returnValue} />
        )}
        {activeTab === 'logs' && (
          <ConsoleLogViewer logs={consoleLogs} maxHeight={400} />
        )}
        {activeTab === 'raw' && (
          <Code block>{JSON.stringify(returnValue, null, 2)}</Code>
        )}
      </Box>
    </Paper>
  );
}

function StructuredValueViewer({ value }: { value: unknown }) {
  if (value === null) return <Text c="dimmed">null</Text>;
  if (value === undefined) return <Text c="dimmed">undefined</Text>;

  if (typeof value === 'string') {
    if (value.length > 100) {
      return (
        <Box>
          <Text component="pre" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {value.slice(0, 100)}...
          </Text>
          <Button size="xs" variant="subtle">Show full text</Button>
        </Box>
      );
    }
    return <Text component="pre" style={{ whiteSpace: 'pre-wrap' }}>"{value}"</Text>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <Text fw={700} c="blue">{String(value)}</Text>;
  }

  if (Array.isArray(value)) {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">Array({value.length})</Text>
        {value.slice(0, 10).map((item, i) => (
          <Box key={i} pl="md" style={{ borderLeft: '2px solid var(--mantine-color-gray-4)' }}>
            <Text size="xs" c="dimmed">[{i}]</Text>
            <StructuredValueViewer value={item} />
          </Box>
        ))}
        {value.length > 10 && (
          <Text size="xs" c="dimmed">...and {value.length - 10} more items</Text>
        )}
      </Stack>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">Object({entries.length} keys)</Text>
        {entries.map(([key, val]) => (
          <Box key={key} pl="md" style={{ borderLeft: '2px solid var(--mantine-color-gray-4)' }}>
            <Group gap="xs">
              <Text size="sm" fw={500}>{key}:</Text>
              <StructuredValueViewer value={val} />
            </Group>
          </Box>
        ))}
      </Stack>
    );
  }

  return <Text>{String(value)}</Text>;
}

function ConsoleLogViewer({ logs, maxHeight }: { logs: ConsoleLog[]; maxHeight?: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Box
      ref={scrollRef}
      bg="var(--mantine-color-dark-9)"
      p="xs"
      style={{ maxHeight, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}
    >
      {logs.map((log, i) => (
        <Box key={i} style={{ color: getLogColor(log.level) }}>
          <Text span size="xs" c="dimmed">[{log.timestamp.toLocaleTimeString()}]</Text>
          {' '}
          <Text span>{log.message}</Text>
        </Box>
      ))}
    </Box>
  );
}
```

---

## 3. Artifacts Tool Renderer

### Features

- File operation visualization (create/update/delete)
- Side-by-side diff viewer
- Preview mode for HTML/markdown

```typescript
// src/features/chat/tool-renderers/ArtifactsToolRenderer.tsx

export class ArtifactsToolRenderer implements ToolRenderer<ArtifactsArgs> {
  renderExecuting(args: ArtifactsArgs) {
    return (
      <ArtifactOperationCard
        operation={args.command}
        filename={args.filename}
        status="running"
      />
    );
  }

  renderSuccess(result: ArtifactsResult) {
    return (
      <ArtifactResultCard
        operation={result.command}
        filename={result.filename}
        content={result.content}
        diff={result.diff}
      />
    );
  }

  renderError(error: ToolError) {
    return (
      <Alert color="red" icon={<XCircle size={16} />}>
        <Text size="sm" fw={500}>Failed to process artifact</Text>
        <Text size="xs">{error.message}</Text>
      </Alert>
    );
  }

  renderSummary(args: ArtifactsArgs, result?: ArtifactsResult) {
    return (
      <Group gap="xs">
        {getOperationIcon(args.command)}
        <Text size="sm" truncate>{args.filename}</Text>
        {result && <Badge size="xs" color="green">Done</Badge>}
      </Group>
    );
  }
}

function ArtifactResultCard({ operation, filename, content, diff }: ArtifactResultCardProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'diff'>('preview');
  const isHtml = filename.endsWith('.html') || filename.endsWith('.htm');
  const isMarkdown = filename.endsWith('.md');

  return (
    <Paper withBorder radius="md" p={0}>
      {/* Header */}
      <Group px="md" py="xs" justify="space-between" bg="var(--mantine-color-green-light)">
        <Group>
          <CheckCircle size={16} color="green" />
          <Text size="sm" fw={500}>
            {operation === 'create' && 'Created'}
            {operation === 'update' && 'Updated'}
            {operation === 'delete' && 'Deleted'}
            {' '}
            {filename}
          </Text>
        </Group>

        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={setViewMode}
          data={[
            { label: 'Preview', value: 'preview', disabled: !isHtml && !isMarkdown },
            { label: 'Code', value: 'code' },
            { label: 'Diff', value: 'diff', disabled: !diff },
          ]}
        />
      </Group>

      {/* Content */}
      <Box p={0}>
        {viewMode === 'preview' && isHtml && (
          <iframe
            srcDoc={content}
            style={{ width: '100%', height: 300, border: 'none' }}
            sandbox="allow-scripts"
          />
        )}
        {viewMode === 'code' && (
          <Code block style={{ maxHeight: 400, overflow: 'auto' }}>
            {content}
          </Code>
        )}
        {viewMode === 'diff' && diff && (
          <DiffViewer oldStr={diff.oldStr} newStr={diff.newStr} />
        )}
      </Box>
    </Paper>
  );
}

function DiffViewer({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  // Simple line-by-line diff
  const diff = computeDiff(oldStr, newStr);

  return (
    <Box style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {diff.map((part, i) => (
        <Box
          key={i}
          px="md"
          py={2}
          bg={part.added ? 'var(--mantine-color-green-light)' : part.removed ? 'var(--mantine-color-red-light)' : undefined}
        >
          <Text span c={part.added ? 'green' : part.removed ? 'red' : 'dimmed'}>
            {part.added ? '+' : part.removed ? '-' : ' '}
            {' '}
            {part.value}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

---

## 4. Navigate Tool Renderer

### Features

- Page transition visualization
- URL breadcrumb display
- Load time metrics

```typescript
// src/features/chat/tool-renderers/NavigateToolRenderer.tsx

export class NavigateToolRenderer implements ToolRenderer<NavigateArgs> {
  renderExecuting(args: NavigateArgs) {
    return (
      <NavigationCard
        url={args.url}
        status="loading"
        progress={0}
      />
    );
  }

  renderSuccess(result: NavigateResult) {
    return (
      <NavigationCard
        url={result.url}
        title={result.pageTitle}
        status="complete"
        loadTime={result.loadTime}
        favicon={result.favicon}
      />
    );
  }

  renderError(error: ToolError) {
    return (
      <Alert color="red" icon={<XCircle size={16} />}>
        <Text size="sm">Navigation failed</Text>
        <Text size="xs">{error.message}</Text>
      </Alert>
    );
  }

  renderSummary(args: NavigateArgs, result?: NavigateResult) {
    return (
      <Group gap="xs">
        <ExternalLink size={16} />
        <Text size="sm" truncate style={{ maxWidth: 300 }}>
          {args.url}
        </Text>
        {result?.loadTime && (
          <Text size="xs" c="dimmed">({result.loadTime}ms)</Text>
        )}
      </Group>
    );
  }
}

function NavigationCard({ url, title, status, loadTime, favicon }: NavigationCardProps) {
  const urlObj = new URL(url);

  return (
    <Paper withBorder radius="md" p="md">
      <Group>
        {status === 'loading' ? (
          <Loader size={24} />
        ) : (
          <ThemeIcon size={40} radius="md" variant="light" color="blue">
            {favicon ? (
              <img src={favicon} alt="" width={24} height={24} />
            ) : (
              <ExternalLink size={24} />
            )}
          </ThemeIcon>
        )}

        <Box style={{ flex: 1 }}>
          <Text size="sm" fw={500} truncate>
            {status === 'loading' ? 'Loading...' : title || url}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {urlObj.hostname}
            {urlObj.pathname !== '/' && urlObj.pathname}
          </Text>
        </Box>

        {loadTime && (
          <Badge size="xs" color={loadTime < 1000 ? 'green' : loadTime < 3000 ? 'yellow' : 'red'}>
            {loadTime}ms
          </Badge>
        )}
      </Group>

      {status === 'loading' && (
        <Progress value={undefined} size="xs" mt="sm" striped animated />
      )}
    </Paper>
  );
}
```

---

## 5. Integration with Chat System

### Message Rendering Update

```typescript
// src/features/chat/MessageBubble.tsx

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'tool') {
    const renderer = toolRendererRegistry.get(message.toolName);

    if (renderer) {
      return (
        <ToolMessageContainer>
          {message.status === 'running' && renderer.renderExecuting(message.args)}
          {message.status === 'success' && renderer.renderSuccess(message.result, message.logs)}
          {message.status === 'error' && renderer.renderError(message.error)}
        </ToolMessageContainer>
      );
    }

    // Fallback to default rendering
    return <DefaultToolMessage message={message} />;
  }

  // ... rest of message rendering
}
```

### Registry Initialization

```typescript
// src/features/chat/tool-renderers/index.ts

import { toolRendererRegistry } from "./registry";
import { ReplToolRenderer } from "./ReplToolRenderer";
import { ArtifactsToolRenderer } from "./ArtifactsToolRenderer";
import { NavigateToolRenderer } from "./NavigateToolRenderer";

export function initializeToolRenderers() {
  toolRendererRegistry.register("repl", new ReplToolRenderer());
  toolRendererRegistry.register("artifacts", new ArtifactsToolRenderer());
  toolRendererRegistry.register("navigate", new NavigateToolRenderer());
}
```

---

## 6. Implementation Plan

### Week 1: Core Infrastructure

- [ ] Create ToolRenderer interface and registry
- [ ] Update MessageBubble to use registry
- [ ] Implement console log streaming system

### Week 2: Specialized Renderers

- [ ] ReplToolRenderer with real-time logs
- [ ] ArtifactsToolRenderer with diff viewer
- [ ] NavigateToolRenderer with metrics

### Week 3: Polish & Integration

- [ ] Syntax highlighting for code
- [ ] Structured value viewer
- [ ] Theme consistency
- [ ] Performance optimization

---

## Success Metrics

- [ ] 3 specialized renderers implemented
- [ ] Console logs stream in real-time (<100ms delay)
- [ ] Structured viewer handles nested objects (depth > 5)
- [ ] Visual distinction between tool types clear

---

## Comparison with 既存拡張

| Feature          | 既存拡張  | Sitesurf v2            |
| ---------------- | --------- | ----------------------- |
| Architecture     | Lit-based | React-based             |
| Real-time logs   | Yes       | Yes + structured viewer |
| Syntax highlight | Basic     | Full Monaco-like        |
| Diff viewer      | Yes       | Yes + side-by-side      |
| Load metrics     | None      | Yes (timing, favicon)   |

---

## References

- Current tool rendering: `src/features/chat/ToolCallBlock.tsx`
- 既存拡張 renderers: `/tmp/pi-github-repos/badlogic/既存拡張/src/messages/`
