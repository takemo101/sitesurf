# Introduction to Zustand

Zustand is a small, fast, and scalable state management solution. It has a comfy API based on hooks and isn't boilerplatey or opinionated, but has enough convention to be explicit and flux-like.

Don't disregard it because it's cute—it has claws! Lots of time was spent dealing with common pitfalls like:

- The dreaded [zombie child problem](https://react-redux.js.org/api/hooks#stale-props-and-zombie-children)
- [React concurrency](https://github.com/bvaughn/rfcs/blob/useMutableSource/text/0000-use-mutable-source.md)
- [Context loss](https://github.com/facebook/react/issues/13332) between mixed renderers

Zustand may be the one state manager in the React space that gets all of these right.

## Installation

Zustand is available as a package on NPM:

```bash
# NPM
npm install zustand

# Yarn
yarn add zustand

# PNPM
pnpm add zustand
```

## Creating Your First Store

Your store is a hook! You can put anything in it: primitives, objects, functions. The `set` function merges state.

```js
import { create } from "zustand";

const useBear = create((set) => ({
  bears: 0,
  increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
  removeAllBears: () => set({ bears: 0 }),
  updateBears: (newBears) => set({ bears: newBears }),
}));
```

## Binding Components

You can use the hook anywhere, without the need of providers. Select your state and the consuming component will re-render when that state changes.

```jsx
function BearCounter() {
  const bears = useBear((state) => state.bears);
  return <h1>{bears} bears around here...</h1>;
}

function Controls() {
  const increasePopulation = useBear((state) => state.increasePopulation);
  return <button onClick={increasePopulation}>one up</button>;
}
```

## How It Works

1. **Store Creation**: The `create` function returns a hook that gives you access to the store
2. **State Selection**: Components select only the state they need via selector functions
3. **Automatic Re-renders**: Only components using changed state will re-render
4. **No Providers Needed**: Unlike Redux or Context API, you don't need provider wrappers

## Try It Live

You can try a live demo on [CodeSandbox](https://codesandbox.io/s/dazzling-moon-itop4).
