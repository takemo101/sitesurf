# AI Provider Integration Guides

## Overview

Configuration and integration guides for 21+ AI model providers including OpenAI, Anthropic, Google, and more.

## Providers by Category

### Large Language Models (LLM)

| Provider       | Models                      | Key Features                           |
| -------------- | --------------------------- | -------------------------------------- |
| OpenAI         | GPT-4, GPT-4 Turbo, GPT-3.5 | Industry standard, excellent reasoning |
| Anthropic      | Claude 3 family             | Strong reasoning, extended context     |
| Google         | Gemini, PaLM                | Multimodal, fast inference             |
| xAI            | Grok                        | Real-time web access, reasoning        |
| Azure OpenAI   | GPT-4, GPT-3.5              | Enterprise Azure integration           |
| Amazon Bedrock | Multiple models             | AWS ecosystem integration              |
| Groq           | Mixtral, Llama              | Ultra-fast inference                   |
| Mistral        | Mistral Large, Medium       | Open-source performance                |
| Together.ai    | Multiple OSS models         | Open-source models                     |
| Cohere         | Command, Coral              | Strong classification                  |
| Perplexity     | Sonar                       | Real-time information                  |
| DeepSeek       | DeepSeek R1, etc.           | Cost-effective alternatives            |
| Cerebras       | GPT variants                | Efficient inference                    |
| Fireworks      | Llama, Mixtral              | Open-source at scale                   |

### Image Generation

| Provider          | Models           | Use Case                 |
| ----------------- | ---------------- | ------------------------ |
| OpenAI            | DALL-E 3         | Photorealistic images    |
| FAL               | Flux, Ideogram   | Quality image generation |
| DeepInfra         | Stable Diffusion | Cost-effective           |
| Black Forest Labs | FLUX             | State-of-the-art quality |
| Replicate         | Multiple         | Community models         |
| xAI               | Grok Imagine     | Integrated with chat     |
| Luma              | Dream Machine    | Video generation         |
| Prodia            | Stable Diffusion | API wrapper              |

### Audio Processing

| Provider      | Type                   | Models                 |
| ------------- | ---------------------- | ---------------------- |
| OpenAI        | Speech & Transcription | Whisper, TTS           |
| Google Vertex | Speech API             | Speech-to-text, TTS    |
| ElevenLabs    | Text-to-Speech         | High-quality voices    |
| AssemblyAI    | Transcription          | Real-time, batch       |
| Deepgram      | Transcription          | Fast, accurate         |
| Gladia        | Transcription          | Multilingual           |
| Groq          | Transcription          | Ultra-fast             |
| LMNT          | Text-to-Speech         | Neural voices          |
| Hume          | Speech Analysis        | Emotional intelligence |
| Revai         | Transcription          | Accurate, affordable   |

### Video Generation

| Provider           | Models               |
| ------------------ | -------------------- |
| Luma Dream Machine | Text/image to video  |
| FAL Video Models   | Various video models |
| Google Vertex      | Video generation     |
| xAI                | Grok video           |

### Embeddings & Semantic Search

| Provider    | Models                 |
| ----------- | ---------------------- |
| OpenAI      | Text embeddings        |
| Google      | Vertex embeddings      |
| Cohere      | Embed models           |
| Mistral     | Embed models           |
| Together.ai | Open-source embeddings |

## Getting Started with a Provider

### Step 1: Create API Account

Visit provider website and sign up for API access.

### Step 2: Get API Key

Generate API key from provider dashboard.

### Step 3: Set Environment Variable

```bash
export OPENAI_API_KEY="your-api-key"
```

### Step 4: Install AI SDK

```bash
npm install ai
```

### Step 5: Use in Code

```typescript
import { generateText } from "ai";

const { text } = await generateText({
  model: "gpt-4",
  prompt: "Hello!",
});
```

## Provider Configuration Examples

### OpenAI

```typescript
import { openai } from "@ai-sdk/openai";

const model = openai("gpt-4");
```

### Anthropic

```typescript
import { anthropic } from "@ai-sdk/anthropic";

const model = anthropic("claude-3-sonnet");
```

### Google Generative AI

```typescript
import { google } from "@ai-sdk/google";

const model = google("gemini-2.5-pro");
```

### Azure OpenAI

```typescript
import { azure } from "@ai-sdk/azure";

const model = azure("gpt-4");
```

## Provider Selection Guide

### By Use Case

**Best for Reasoning & Complex Tasks:**

- Claude (Anthropic)
- o3 (OpenAI)
- DeepSeek R1

**Best for Speed:**

- Groq (Mixtral)
- Together.ai
- Fireworks

**Best for Cost:**

- DeepSeek
- Groq free tier
- Local models (Ollama)

**Best for Multimodal:**

- Gemini (Google)
- Claude (Anthropic)
- GPT-4V (OpenAI)

**Best for Image Generation:**

- DALL-E 3 (OpenAI)
- FLUX (Black Forest Labs)
- Stable Diffusion (multiple hosts)

**Best for Audio:**

- OpenAI Whisper (transcription)
- ElevenLabs (speech synthesis)

### By Scale

**Startup/Small Scale:**

- Groq free tier
- DeepSeek
- Ollama (self-hosted)

**Growth Stage:**

- OpenAI
- Anthropic
- Google Vertex

**Enterprise:**

- Azure OpenAI
- AWS Bedrock
- Vertex AI with SLA

## Pricing Comparison

Consider:

- Input token cost
- Output token cost
- API call fees
- Volume discounts
- Free tier availability

Most providers offer free trials or credits for new users.

## Authentication

Each provider requires:

1. **API Key** - Authenticate requests
2. **Environment Setup** - Store keys securely
3. **Error Handling** - Manage auth failures
4. **Rate Limiting** - Handle quota limits

## Fallback & Multi-Provider

Use multiple providers for:

- **Redundancy** - If primary fails
- **Cost Optimization** - Use cheapest option
- **Model Comparison** - Test different models
- **Specialization** - Use best provider per task

## Regional Availability

Consider:

- Data residency requirements
- Regional pricing
- Latency from your region
- Compliance requirements (GDPR, HIPAA)

## API Limits & Rate Limiting

Each provider has:

- Requests per minute (RPM)
- Tokens per minute (TPM)
- Daily limits
- Quota adjustments available

## Monitoring & Cost Control

- Track API usage and costs
- Set up billing alerts
- Use DevTools for debugging
- Monitor token usage per call
- Implement caching to reduce calls

## Community & Open-Source Providers

- **Ollama** - Run models locally
- **LM Studio** - Simple local interface
- **HuggingFace** - Community models
- **Together.ai** - Open-source at scale
- **Fireworks** - OSS inference

## Related Documentation

- **Getting Started** - Framework setup
- **Core** - API reference
- **Foundations** - Provider selection guide

---

**File:** `providers.md` (21 pages consolidated)

**Includes detailed integration guides for all supported providers.**
