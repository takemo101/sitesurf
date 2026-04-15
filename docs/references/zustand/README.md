# Zustand Documentation

> Source: https://zustand.docs.pmnd.rs/
> Crawled: 2026-04-04T11:04:58.143Z
> Pages: 13 → 8 files

## Overview

Zustand is a small, fast, and scalable state management solution with a comfy API based on hooks. It isn't boilerplatey or opinionated, but has enough convention to be explicit and flux-like. The library handles common React pitfalls like the zombie child problem, React concurrency, and context loss between mixed renderers.

## Documentation Structure

### Getting Started

| File                                                               | Description                                               |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| [getting-started/introduction.md](getting-started/introduction.md) | Installation, basic store creation, and component binding |
| [getting-started/comparison.md](getting-started/comparison.md)     | Comparison with Redux, Valtio, Jotai, and Recoil          |
| [getting-started/tutorial.md](getting-started/tutorial.md)         | Complete Tic-Tac-Toe tutorial covering core concepts      |

### API Reference

| File                                           | Description                                           |
| ---------------------------------------------- | ----------------------------------------------------- |
| [api/create-api.md](api/create-api.md)         | Core `create()` function for building stores          |
| [api/use-store-hook.md](api/use-store-hook.md) | `useStore` hook for accessing vanilla stores in React |

### Guides and Patterns

| File                                           | Description                                  |
| ---------------------------------------------- | -------------------------------------------- |
| [guides/persistence.md](guides/persistence.md) | State persistence using `persist` middleware |

### Migration and Legacy

| File                                                             | Description                                     |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| [migration/v5-migration.md](migration/v5-migration.md)           | Upgrading from v4 to v5                         |
| [migration/v3-create-context.md](migration/v3-create-context.md) | Legacy `createContext` API from v3 (deprecated) |

## Key Concepts

### Store Creation

Zustand stores are created using the `create` function. Stores are hooks that can hold any JavaScript value—primitives, objects, functions—with automatic shallow merging for state updates.

### Selector Pattern

Components select only the state they need, enabling efficient re-renders. The library provides selectors to avoid re-renders when state changes don't affect selected values.

### Persistence

The `persist` middleware enables storing state in `localStorage`, `sessionStorage`, or custom storage engines. It supports versioning, migrations, and manual hydration control.

### Vanilla Stores

Zustand can create vanilla (non-React) stores using `createStore`, which can be integrated into React via the `useStore` hook or used standalone.

## Quick Start

```js
import { create } from "zustand";

const useBear = create((set) => ({
  bears: 0,
  increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
  removeAllBears: () => set({ bears: 0 }),
}));
```

```jsx
function BearCounter() {
  const bears = useBear((state) => state.bears);
  return <h1>{bears} bears around here...</h1>;
}
```

## Features

- **Simple API**: Hook-based store creation without boilerplate
- **Concurrency Safe**: Handles React concurrent rendering correctly
- **Type-Safe**: Full TypeScript support with inferred types
- **Extensible**: Middleware system for adding persistence, DevTools, Immer, etc.
- **Framework Agnostic**: Use vanilla stores independently or with React
- **SSR Compatible**: Proper hydration support for server-rendered apps
