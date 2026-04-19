# Security Middleware Design Document

**Date**: 2026-04-08（initial）/ updated through v0.1.3+
**Status**: Implemented
**Target**: ツール出力経由のプロンプトインジェクション検知

---

## Overview

ツール出力（`browserjs` / `bg_fetch` / `readPage` 等、REPL 内 helper を含む）に紛れ込んだ「指示らしき文字列」をリアルタイム検出し、AI に渡る前に安全な要約だけを返すミドルウェア。実装は `src/features/security/`。

---

## Design Goals

1. **Real-time Detection**: ツール結果を AI 履歴に追加する直前で解析
2. **Transparent Alerts**: ユーザにはチャット内のシステムメッセージで通知
3. **Pattern-based Detection**: 同期 regex で軽量に判定
4. **User Control**: 設定 → システムから ON/OFF 可能（`enableSecurityMiddleware`、デフォルト ON）

---

## 設定 UI と監査ログ

PR #23/#24 で設定タブから「セキュリティ」専用タブが分離された。

| 設定タブ     | 内容                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| システム     | プロンプトインジェクション検知の ON/OFF（`enableSecurityMiddleware`）   |
| セキュリティ | 監査ログの一覧（タブ表示時に lazy load。直近20件、confidence で色分け） |

監査ログは `loadSecurityAuditEntries(storage, limit)` で IndexedDB から読み出される。`AuditLogger.logSecurityEvent` 失敗時もツール出力処理は止めない（`processToolOutput` で try/catch）。

---

## エージェントループとの統合

```typescript
// orchestration/agent-loop.ts (executeToolCall 内)
const securityEnabled = useStore.getState().settings.enableSecurityMiddleware;
if (securityEnabled && !fullResult.includes("data:image/")) {
  const securityResult = await securityMiddleware.processToolOutput(fullResult, {
    source: name,
    sessionId: session.id,
  });
  if (securityResult.alert) {
    chatStore.addSystemMessage(
      "⚠️ ツール出力内に不審な指示らしきテキストを検出したため、AI には安全な要約だけを返しました。",
    );
    // fullResult を安全な要約に差し替えて AI に返す
  }
}
```

スクリーンショット（`data:image/`）はバイナリのため検出対象外。

---

## Architecture

```
Security Middleware
├── DetectionEngine (Regex-based)
│   └── Pattern matching for injection attempts
├── AlertRenderer (Inline)
│   └── Warning UI with user actions
└── AuditLogger
    └── Security event logging
```

---

## Detection Patterns

### Standard Pattern Set

```typescript
const INJECTION_PATTERNS = [
  // Instruction override
  /ignore\s+(previous|all|prior)\s+instructions/i,
  /disregard\s+(the|your)\s+system\s+prompt/i,
  /forget\s+(previous|all|prior)\s+instructions/i,

  // Role change
  /you\s+are\s+now\s+\w+/i,
  /your\s+new\s+role\s+is/i,
  /you\s+have\s+been\s+\w+/i,

  // Known attack vectors
  /DAN\s*mode/i,
  /jailbreak/i,
  /system\s+override/i,
  /developer\s+mode/i,

  // Command execution
  /execute\s+the\s+following/i,
  /run\s+this\s+code/i,
  /follow\s+these\s+instructions/i,

  // Authority impersonation
  /as\s+(the\s+)?(developer|admin|system)/i,
  /this\s+is\s+(the\s+)?(developer|admin|system)/i,
] as const;
```

### Detection Logic

```typescript
interface DetectionResult {
  detected: boolean;
  pattern?: string;
  confidence: "low" | "medium" | "high";
  matchedText: string;
}

class DetectionEngine {
  detect(text: string): DetectionResult {
    for (const pattern of INJECTION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return {
          detected: true,
          pattern: pattern.source,
          confidence: this.calculateConfidence(match),
          matchedText: match[0],
        };
      }
    }
    return { detected: false, confidence: "low", matchedText: "" };
  }

  private calculateConfidence(match: RegExpMatchArray): "low" | "medium" | "high" {
    // Context-based confidence scoring
    const context = match.input?.slice(
      Math.max(0, match.index! - 50),
      match.index! + match[0].length + 50,
    );

    if (context?.includes("system") || context?.includes("instruction")) {
      return "high";
    }
    if (context?.includes("ignore") || context?.includes("disregard")) {
      return "medium";
    }
    return "low";
  }
}
```

---

## Alert System

### Inline Warning Component

```tsx
// src/features/security/SecurityWarning.tsx

interface SecurityWarningProps {
  pattern: string;
  confidence: "low" | "medium" | "high";
  matchedText: string;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export function SecurityWarning({
  pattern,
  confidence,
  matchedText,
  onDismiss,
  onViewDetails,
}: SecurityWarningProps) {
  const colors = {
    low: "yellow",
    medium: "orange",
    high: "red",
  };

  return (
    <Alert color={colors[confidence]} title="⚠️ セキュリティ警告" icon={<ShieldAlert size={16} />}>
      <Stack gap="xs">
        <Text size="sm">
          潜在的なプロンプトインジェクションを検出しました。
          このコンテンツに命令が含まれている可能性があります。
        </Text>

        <Group gap="xs">
          <Badge size="xs" color={colors[confidence]}>
            信頼度: {confidence}
          </Badge>
          <Code size="xs">{matchedText.slice(0, 30)}...</Code>
        </Group>

        <Group gap="xs" mt="xs">
          <Button size="xs" variant="light" onClick={onViewDetails}>
            詳細を見る
          </Button>
          <Button size="xs" variant="subtle" onClick={onDismiss}>
            無視する
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}
```

### Integration with Tool Messages

```typescript
// src/features/chat/message-renderer.tsx

export function renderToolMessage(
  message: ToolMessage,
  securityCheck: SecurityCheckResult
) {
  return (
    <Box>
      {securityCheck.detected && (
        <SecurityWarning
          pattern={securityCheck.pattern}
          confidence={securityCheck.confidence}
          matchedText={securityCheck.matchedText}
          onDismiss={() => dismissWarning(message.id)}
          onViewDetails={() => showSecurityDetails(securityCheck)}
        />
      )}

      <ToolOutputContent output={message.output} />
    </Box>
  );
}
```

---

## Middleware Integration

### Pipeline Architecture

```typescript
// src/features/security/middleware.ts

export class SecurityMiddleware {
  private detectionEngine: DetectionEngine;
  private auditLogger: AuditLogger;

  constructor() {
    this.detectionEngine = new DetectionEngine();
    this.auditLogger = new AuditLogger();
  }

  async processToolOutput(
    toolName: string,
    output: string,
    context: ExecutionContext,
  ): Promise<SecurityCheckResult> {
    // 1. Detect
    const detection = this.detectionEngine.detect(output);

    // 2. Log
    if (detection.detected) {
      await this.auditLogger.log({
        type: "prompt_injection_attempt",
        tool: toolName,
        pattern: detection.pattern,
        confidence: detection.confidence,
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId,
      });
    }

    // 3. Return result
    return {
      ...detection,
      toolName,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Integration Points

```typescript
// In tool execution pipeline
export async function executeTool(
  tool: Tool,
  args: unknown,
  securityMiddleware: SecurityMiddleware,
): Promise<ToolResult> {
  // Execute tool
  const result = await tool.execute(args);

  // Security check
  const securityCheck = await securityMiddleware.processToolOutput(
    tool.name,
    JSON.stringify(result),
    { sessionId: getCurrentSessionId() },
  );

  return {
    ...result,
    securityCheck,
  };
}
```

---

## Audit Logging

### Log Structure

```typescript
interface SecurityAuditLog {
  id: string;
  timestamp: string;
  sessionId: string;
  type: "prompt_injection_attempt" | "security_warning_dismissed" | "security_alert_triggered";
  tool?: string;
  pattern?: string;
  confidence?: "low" | "medium" | "high";
  userAction?: "dismissed" | "viewed" | "reported";
}

class AuditLogger {
  async log(event: Omit<SecurityAuditLog, "id" | "timestamp">): Promise<void> {
    const logEntry: SecurityAuditLog = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Store in local storage for debugging
    const logs = await this.getLogs();
    logs.push(logEntry);
    await storage.set("security_audit_logs", logs.slice(-1000)); // Keep last 1000

    // Report to analytics (anonymized)
    if (event.type === "prompt_injection_attempt") {
      await analytics.track("security_event", {
        type: event.type,
        confidence: event.confidence,
      });
    }
  }
}
```

---

## User Experience

### Normal Flow

1. Tool executes
2. Output is analyzed
3. No threat detected → Normal display

### Threat Detected Flow

1. Tool executes
2. Injection pattern detected
3. Inline warning displayed
4. User chooses:
   - "詳細を見る" → Show full detection details
   - "無視する" → Dismiss warning and show output

### Settings

```typescript
// User-configurable security settings
interface SecuritySettings {
  // Detection sensitivity
  sensitivity: "low" | "medium" | "high";

  // Auto-dismiss behavior
  autoDismissLowConfidence: boolean;

  // Notification preferences
  showInlineWarnings: boolean;
  playSoundOnHighConfidence: boolean;
}
```

---

## Implementation Plan

### Week 1: Core Detection

- [ ] Create DetectionEngine with pattern matching
- [ ] Implement SecurityWarning component
- [ ] Add security middleware to tool pipeline

### Week 2: Integration & Testing

- [ ] Integrate with message renderer
- [ ] Implement audit logging
- [ ] Add security settings UI
- [ ] Test with known injection patterns

### Week 3: Rollout

- [ ] Feature flag: useSecurityMiddleware
- [ ] Monitor false positive rate
- [ ] Adjust patterns based on feedback
- [ ] Full rollout

---

## Success Metrics

### Quantitative

- [ ] Detection rate: >95% of known patterns
- [ ] False positive rate: <5%
- [ ] Response time: <10ms per check

### Qualitative

- [ ] Users feel safer
- [ ] No workflow disruption
- [ ] Easy to understand warnings

---

## Comparison with 既存拡張

| Feature            | 既存拡張                | Sitesurf              |
| ------------------ | ----------------------- | --------------------- |
| Detection          | Pattern-based in prompt | Dedicated middleware  |
| Alert              | Text warning            | Inline visual warning |
| User control       | None explicit           | Dismiss/View options  |
| Audit logging      | None                    | Full audit trail      |
| Confidence scoring | None                    | Low/Medium/High       |

---

## Risks & Mitigations

| Risk               | Mitigation                             |
| ------------------ | -------------------------------------- |
| False positives    | Configurable sensitivity, easy dismiss |
| Performance impact | Async processing, caching              |
| Pattern bypass     | Regular pattern updates                |

---

## References

- System prompt v2 security section: `docs/design/system-prompt-v2-design.md`
- 既存拡張 analysis: `docs/analysis/既存拡張-VS-SITESURF.md`
