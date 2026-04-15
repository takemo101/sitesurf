---
name: tandemweb-mcp
description: Use TandemWeb MCP/CLI to control the currently open Chrome session (tabs, navigation, DOM interaction, extraction, screenshots, element picking). Best when a coding agent needs real browser state to gather evidence before generating code.
allowed-tools: Bash(tandemweb:*)
---

# TandemWeb MCP Browser Operations

Use `tandemweb` CLI to operate the real browser session via the TandemWeb extension.

## When to use

- Reproduce UI bugs in the user’s currently logged-in browser state
- Collect real DOM/text/screenshots before writing code
- Identify robust selectors with visual picking
- Extract image/video frame data for analysis

## Core workflow

1. Discover target tab
2. Switch/navigate
3. Read + inspect
4. Interact
5. Re-read / screenshot / extract

```bash
tandemweb tabs-list
tandemweb tab-switch 123456
tandemweb page-read --tabId 123456
tandemweb page-pick-element --tabId 123456 --message "対象要素を選択してください"
```

## Available commands

### Tab controls

```bash
tandemweb tabs-list
tandemweb tab-create --url "https://example.com"
tandemweb tab-navigate 123456 --url "https://example.com/settings"
tandemweb tab-switch 123456
tandemweb tab-close 123456
```

### Page operations

```bash
tandemweb page-read --tabId 123456
tandemweb page-click --tabId 123456 --selector "button[type='submit']"
tandemweb page-click --tabId 123456 --x 320 --y 480
tandemweb page-type --tabId 123456 --selector "input[name='email']" --text "user@example.com"
tandemweb page-eval --tabId 123456 --code "return document.title"
tandemweb screenshot --tabId 123456
```

### Element targeting / media extraction

```bash
tandemweb page-pick-element --tabId 123456 --message "クリックして選択"
tandemweb page-extract-image --tabId 123456 --selector "img.hero"
tandemweb page-extract-image --tabId 123456 --selector "video" --maxWidth 1024
```

## Practical patterns for coding agents

### Pattern A: Bug reproduction evidence

```bash
tandemweb tabs-list
tandemweb tab-switch 123456
tandemweb page-read --tabId 123456
tandemweb screenshot --tabId 123456
```

Then summarize: current URL, visible state, extracted text, screenshot observations.

### Pattern B: Find selector safely

```bash
tandemweb page-pick-element --tabId 123456 --message "対象要素をクリック"
```

Use returned selector in subsequent `page-click`, `page-type`, or `page-eval`.

### Pattern C: Structured DOM extraction before implementation

```bash
tandemweb page-eval --tabId 123456 --code "return Array.from(document.querySelectorAll('table tr')).map(tr=>Array.from(tr.cells).map(td=>td.textContent?.trim()))"
```

Use extracted data as the source of truth for code generation.

## Notes

- `page-eval` should prefer read/extract logic over heavy interaction.
- Re-run `tabs-list` if tab IDs changed.
- `page-pick-element` may be limited by cross-origin iframe boundaries.
- For repeatable automation, prefer selector-based commands over coordinates.
