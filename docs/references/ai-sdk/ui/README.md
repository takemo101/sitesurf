# AI SDK UI - Frontend Components

## Overview

Frontend hooks and components for React applications. Includes chatbot UI, streaming data handling, and generative UI patterns.

## Contents

1. **UI Overview** - Introduction to AI SDK UI components
2. **Chatbot** - useChat hook for chat interfaces
3. **Chatbot Message Persistence** - Save and restore chat history
4. **Chatbot Resume Streams** - Continue interrupted streams
5. **Chatbot Tool Usage** - Display tool calls and results
6. **Generative User Interfaces** - AI-generated components
7. **Completion** - useCompletion hook for text generation
8. **Object Generation** - useObject hook for JSON generation
9. **Streaming Custom Data** - Stream application-specific data
10. **Error Handling** - Manage errors in UI
11. **Transport** - Custom transports for data communication
12. **Reading UIMessage Streams** - Parse streamed UI messages
13. **Message Metadata** - Attach metadata to messages
14. **Stream Protocols** - Protocol specifications

## Main Hooks

### useChat

```typescript
const { messages, input, handleInputChange, handleSubmit, append } = useChat();
```

Features:

- Manage conversation history
- Send user messages
- Stream AI responses
- Handle tool calls
- Persist messages

### useCompletion

```typescript
const { completion, input, handleInputChange, handleSubmit } = useCompletion();
```

Features:

- Stream text generation
- Single-turn interactions
- Real-time output
- Error handling

### useObject

```typescript
const { object, submit, isLoading } = useObject({
  api: "/api/generate-object",
  schema: MySchema,
});
```

Features:

- Structured output generation
- Streaming object updates
- Schema validation
- Incremental JSON parsing

## Common Patterns

### Basic Chat

```typescript
export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Chat with Tool Display

```typescript
const { messages } = useChat();
return (
  <div>
    {messages.map(m => (
      <div key={m.id}>
        {m.content}
        {m.toolInvocations?.map(t => (
          <ToolResult key={t.id} tool={t} />
        ))}
      </div>
    ))}
  </div>
);
```

### Persistent Chat

```typescript
const { messages, append } = useChat({
  id: "chat-1",
  storage: localStorage,
  initialMessages: savedMessages,
});
```

### Generative UI

```typescript
const { messages } = useChat({
  experimental_prepareRequestBody() {
    return {
      // Custom request configuration
    };
  },
});
```

## Features by Use Case

| Use Case         | Hook          | Key Features                 |
| ---------------- | ------------- | ---------------------------- |
| Chat Application | useChat       | Messages, streaming, tools   |
| Text Generation  | useCompletion | Streaming, simple interface  |
| Form Generation  | useObject     | Schema validation, JSON      |
| Custom Data      | streamUI      | Protocol-based streaming     |
| AI UI            | Generative UI | Dynamic component generation |

## Message Structure

```typescript
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolInvocations?: ToolInvocation[];
}

interface ToolInvocation {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}
```

## Advanced Features

### Message Persistence

- Save chat history to database/storage
- Resume conversations
- Multi-session management
- Automatic sync

### Stream Resumption

- Continue interrupted streams
- Handle network failures
- Partial message recovery
- Graceful degradation

### Custom Transport

- Use HTTP, WebSocket, or custom protocol
- Custom serialization
- Authentication headers
- Request/response transformation

### Metadata

- Attach custom data to messages
- Track message properties
- Custom UI rendering per message
- Analytics and logging

### Error Handling

- Network error recovery
- Invalid response handling
- User-friendly error display
- Automatic retry logic

## Integration Patterns

### With Agents

Display agent thinking and tool usage:

- Show step-by-step reasoning
- Display tool calls as they happen
- Stream intermediate results

### With Server Actions

Use Next.js server actions with useChat:

- Type-safe communication
- Server-side validation
- Direct database access

### With Custom Backend

Point to custom API endpoints:

- Custom authentication
- Custom business logic
- Existing backend integration

## UI Patterns

### Split View

- Left: chat history
- Right: AI responses with tools shown

### Streaming Progress

- Show partial responses
- Token count updates
- Loading indicators

### Tool Invocation Display

- Tool name and parameters
- Tool result visualization
- User feedback options

### Message Metadata Display

- Timestamp
- Model used
- Token count
- Cost information

## Performance Tips

1. **Virtualize Long Lists** - For many messages
2. **Debounce Input** - Reduce re-renders
3. **Memoize Components** - Prevent unnecessary updates
4. **Stream Efficiently** - Don't parse too frequently
5. **Handle Errors** - Provide fallback UI

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support
- Focus management

## Related Documentation

- **Core** - Server-side implementation
- **Agents** - For agent-based interactions
- **Getting Started** - Framework integration
- **Advanced** - Custom implementations

---

**File:** `ui.md` (16 pages consolidated)

**This section focuses on frontend/React integration for AI features.**
