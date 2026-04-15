# AI SDK Core API Reference

## Overview

Complete reference for all AI SDK Core functions and features. This is the main API documentation for text generation, structured data, tool calling, media processing, and more.

## Core Functions

### Text Generation

- **`generateText()`** - Generate single text response
- **`streamText()`** - Stream text response in real-time

### Structured Data

- **`generateObject()`** - Generate JSON object with schema validation
- **`streamObject()`** - Stream structured object generation

### Tool Calling

- **`tool()`** - Define tools for AI agents
- **`dynamicTool()`** - Runtime-generated tools
- Tool result handling and multi-turn calling

### Media Processing

- **`generateImage()`** - Generate images from text descriptions
- **`transcribe()`** - Convert audio to text
- **`generateSpeech()`** - Convert text to speech
- **`generateVideo()`** - Generate videos

### Embeddings & Search

- **`embed()`** - Create text embeddings
- **`embedMany()`** - Batch embedding generation
- **`rerank()`** - Re-rank search results by relevance

### Advanced Features

- **Middleware** - Intercept and modify model behavior
- **Provider Management** - Work with multiple providers
- **Error Handling** - Comprehensive error types
- **Testing** - Mock providers and simulate responses
- **Telemetry** - Track usage and performance
- **DevTools** - Debug agents and requests
- **Event Callbacks** - Subscribe to execution events

## Organization by Feature

| Feature          | File                  | Purpose                  |
| ---------------- | --------------------- | ------------------------ |
| Text Generation  | core.md (section 1-2) | Generate and stream text |
| Structured Data  | core.md (section 3)   | Generate JSON/objects    |
| Tool Calling     | core.md (section 4-5) | Enable agent actions     |
| Embeddings       | core.md (section 8)   | Vector similarity search |
| Image Generation | core.md (section 9)   | DALL-E, Midjourney, etc. |
| Transcription    | core.md (section 10)  | Speech-to-text           |
| Speech           | core.md (section 11)  | Text-to-speech           |
| Video Generation | core.md (section 12)  | Video creation           |
| Middleware       | core.md (section 13)  | Modify model behavior    |
| Provider Mgmt    | core.md (section 14)  | Multi-provider support   |
| Error Handling   | core.md (section 15)  | Exception handling       |
| Testing          | core.md (section 16)  | Mock providers           |
| Telemetry        | core.md (section 17)  | Monitoring & logging     |
| DevTools         | core.md (section 18)  | Debugging                |
| Events           | core.md (section 19)  | Lifecycle callbacks      |

## Common Patterns

### Text Generation

```typescript
import { generateText } from "ai";

const { text } = await generateText({
  model: "gpt-4",
  prompt: "Write a poem about AI",
});
```

### Streaming Text

```typescript
import { streamText } from "ai";

const { textStream } = streamText({
  model: "gpt-4",
  prompt: "Generate a story",
});

for await (const chunk of textStream) {
  console.log(chunk);
}
```

### Tool Calling

```typescript
import { generateText, tool } from "ai";

const result = await generateText({
  model: "gpt-4",
  tools: {
    search: tool({
      description: "Search the internet",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        /* ... */
      },
    }),
  },
  prompt: "Find information about AI",
});
```

### Structured Data

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const { object } = await generateObject({
  model: "gpt-4",
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  prompt: "Extract user info from: John, 25, john@example.com",
});
```

## Key Concepts

### Models

Functions work with any supported model provider. Specify via `model` parameter (e.g., `'gpt-4'`, `'claude-3-sonnet'`).

### Streaming

All major functions have streaming alternatives. Use for:

- Better UX (show results as they arrive)
- Reduced latency perception
- Large responses that don't fit in memory

### Tools

Enable LLM to call custom functions. Essential for:

- Agents
- Complex workflows
- External data integration

### Schemas

Use Zod or JSON Schema for structure validation. Ensures:

- Type-safe output
- Valid JSON generation
- Predictable result formats

### Error Handling

Comprehensive error types for:

- API failures
- Validation errors
- Timeout handling
- Fallback strategies

## Advanced Topics

### Middleware

Modify request/response at model level:

- Add system prompts
- Cache responses
- Log all calls
- Custom formatting

### Provider Management

Work with multiple providers:

- Failover between providers
- Cost optimization
- Model comparison
- Load balancing

### Testing

Mock providers for testing:

- Unit test AI features
- No API calls needed
- Deterministic results
- Fast test execution

### Telemetry

Monitor agent behavior:

- Token usage
- Latency metrics
- Error rates
- Cost tracking

## Settings & Configuration

### Common Options

- `temperature` - Randomness (0-2)
- `topP` - Nucleus sampling threshold
- `topK` - Top K sampling
- `maxTokens` - Response length limit
- `stopSequences` - Custom stop tokens

### Provider-Specific Options

Each provider supports additional options:

- OpenAI: `frequencyPenalty`, `presencePenalty`
- Anthropic: `thinkingBudget`, `budgetTokens`
- Custom headers and timeouts

## Performance Considerations

1. **Use Streaming** - Better perceived performance
2. **Batch Requests** - Multiple items at once
3. **Cache Responses** - Avoid redundant calls
4. **Select Right Model** - Balance speed/quality
5. **Monitor Tokens** - Track usage and costs

## Related Documentation

- **Getting Started** - Framework-specific setup
- **Agents** - Multi-step reasoning with tools
- **UI** - Frontend integration
- **Providers** - Model provider configuration
- **Foundations** - Core concepts

---

**File:** `core.md` (22 pages consolidated)

**This is the authoritative reference for all AI SDK Core functionality.**
