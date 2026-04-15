# createContext from zustand/context (Deprecated)

> **Deprecated in v4, Removed in v5**
>
> This API is no longer recommended. See [Migration Guide](#migration) for modern alternatives.

A special `createContext` was provided in v3, which avoided misusing the store hook. This feature is deprecated in v4 and removed in v5.

## Legacy Usage

```jsx
import create from "zustand";
import createContext from "zustand/context";

const { Provider, useStore } = createContext();

const createStore = () =>
  create((set) => ({
    bears: 0,
    increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
    removeAllBears: () => set({ bears: 0 }),
  }));

const App = () => (
  <Provider createStore={createStore}>
    <YourComponent />
  </Provider>
);

const YourComponent = () => {
  const state = useStore();
  const slice = useStore((selector) => selector.field);
};
```

## Legacy Usage in Real Components

```jsx
import create from "zustand";
import createContext from "zustand/context";

const { Provider, useStore } = createContext();

const createStore = () =>
  create((set) => ({
    bears: 0,
    increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
    removeAllBears: () => set({ bears: 0 }),
  }));

const Button = () => {
  return (
    <Provider createStore={createStore}>
      <ButtonChild />
    </Provider>
  );
};

const ButtonChild = () => {
  const state = useStore();
  return (
    <div>
      {state.bears}
      <button onClick={() => state.increasePopulation()}>+</button>
    </div>
  );
};

export default function App() {
  return (
    <div className="App">
      <Button />
      <Button />
    </div>
  );
}
```

## Legacy Usage with Props Initialization

```tsx
import create from "zustand";
import createContext from "zustand/context";

const { Provider, useStore } = createContext();

export default function App({ initialBears }) {
  return (
    <Provider
      createStore={() =>
        create((set) => ({
          bears: initialBears,
          increase: () => set((state) => ({ bears: state.bears + 1 })),
        }))
      }
    >
      <Button />
    </Provider>
  );
}
```

## Migration to Modern API

The modern approach uses React's `createContext` and `useStore` hook directly:

```jsx
import { createContext, useContext, useRef, ReactNode } from 'react'
import { createStore, useStore } from 'zustand'

const StoreContext = createContext<ReturnType<typeof createStore> | null>(null)

const StoreProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<ReturnType<typeof createStore> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createStore((set) => ({
      bears: 0,
      increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
      removeAllBears: () => set({ bears: 0 }),
    }))
  }
  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  )
}

const useStoreInContext = <U,>(selector: (state: StoreState) => U) => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('Missing StoreProvider')
  }
  return useStore(store, selector)
}
```

Usage:

```jsx
const Button = () => {
  return (
    <StoreProvider>
      <ButtonChild />
    </StoreProvider>
  );
};

const ButtonChild = () => {
  const bears = useStoreInContext((state) => state.bears);
  const increasePopulation = useStoreInContext((state) => state.increasePopulation);
  return (
    <div>
      {bears}
      <button onClick={() => increasePopulation()}>+</button>
    </div>
  );
};

export default function App() {
  return (
    <div className="App">
      <Button />
      <Button />
    </div>
  );
}
```

## Alternative with Props Initialization

```tsx
import { createContext, useContext, useRef, ReactNode } from "react";
import { createStore, useStore } from "zustand";

interface StoreState {
  bears: number;
  increasePopulation: () => void;
  removeAllBears: () => void;
}

const StoreContext = createContext<ReturnType<typeof createStore> | null>(null);

interface StoreProviderProps {
  children: ReactNode;
  initialBears?: number;
}

const StoreProvider = ({ children, initialBears = 0 }: StoreProviderProps) => {
  const storeRef = useRef<ReturnType<typeof createStore> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createStore<StoreState>((set) => ({
      bears: initialBears,
      increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
      removeAllBears: () => set({ bears: 0 }),
    }));
  }
  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>;
};

const useStoreInContext = <U,>(selector: (state: StoreState) => U) => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("Missing StoreProvider");
  }
  return useStore(store, selector);
};

export default function App() {
  return (
    <StoreProvider initialBears={5}>
      <YourComponent />
    </StoreProvider>
  );
}
```

## Third-Party Alternatives

If you prefer a more complete solution similar to v3's `createContext`, consider these libraries:

- [zustand-di](https://github.com/charkour/zustand-di) — Dependency injection pattern for Zustand
- [zustand-utils](https://github.com/arvinxx/zustand-utils) — Additional utilities for Zustand

## Why Was This Removed?

The v3 `createContext` API was removed because:

1. **Clearer Semantics**: Using React's `createContext` directly makes the pattern more explicit
2. **Better Type Safety**: React's context types are more mature
3. **Less Magic**: Users have more control over store creation and initialization
4. **Alignment with Modern Patterns**: Matches modern React idioms better

## Key Differences

| Aspect           | v3 createContext | Modern Approach             |
| ---------------- | ---------------- | --------------------------- |
| Store Creation   | Abstracted       | Explicit with `createStore` |
| Context Provider | Hidden           | Explicit React Context      |
| Type Safety      | Limited          | Full TypeScript support     |
| Control          | Less             | More                        |
| Bundle Size      | Slightly smaller | Slightly larger             |
