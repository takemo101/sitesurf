# useStore Hook

The `useStore` hook lets you use a vanilla store (created with `createStore`) in React components.

```js
const someState = useStore(store, selectorFn);
```

## Signature

```ts
useStore<StoreApi<T>, U = T>(store: StoreApi<T>, selectorFn?: (state: T) => U) => UseBoundStore<StoreApi<T>>
```

## Reference

### `useStore(store, selectorFn)`

#### Parameters

- `store`: The store instance created with `createStore`
- `selectorFn`: Optional function that returns data based on current state

#### Returns

Returns any data based on current state according to the selector function.

## Usage Examples

### Using a Global Vanilla Store

First, create a vanilla store:

```ts
import { createStore } from "zustand";

type PositionStoreState = { position: { x: number; y: number } };

type PositionStoreActions = {
  setPosition: (nextPosition: PositionStoreState["position"]) => void;
};

type PositionStore = PositionStoreState & PositionStoreActions;

const positionStore = createStore<PositionStore>()((set) => ({
  position: { x: 0, y: 0 },
  setPosition: (position) => set({ position }),
}));
```

Then use it in a React component:

```tsx
import { useStore } from "zustand";

function MovingDot() {
  const position = useStore(positionStore, (state) => state.position);
  const setPosition = useStore(positionStore, (state) => state.setPosition);

  return (
    <div
      onPointerMove={(e) => {
        setPosition({
          x: e.clientX,
          y: e.clientY,
        });
      }}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
      }}
    >
      <div
        style={{
          position: "absolute",
          backgroundColor: "red",
          borderRadius: "50%",
          transform: `translate(${position.x}px, ${position.y}px)`,
          left: -10,
          top: -10,
          width: 20,
          height: 20,
        }}
      />
    </div>
  );
}

export default function App() {
  return <MovingDot />;
}
```

### Using Dynamic Vanilla Stores

Create a factory function to generate multiple store instances:

```ts
type CounterStore = {
  count: number;
  increment: () => void;
};

const createCounterStore = () => {
  return createStore<CounterStore>()((set) => ({
    count: 0,
    increment: () => {
      set((state) => ({ count: state.count + 1 }));
    },
  }));
};

const defaultCounterStores = new Map<string, ReturnType<typeof createCounterStore>>();

const createCounterStoreFactory = (counterStores: typeof defaultCounterStores) => {
  return (counterStoreKey: string) => {
    if (!counterStores.has(counterStoreKey)) {
      counterStores.set(counterStoreKey, createCounterStore());
    }
    return counterStores.get(counterStoreKey)!;
  };
};

const getOrCreateCounterStoreByKey = createCounterStoreFactory(defaultCounterStores);
```

Use in a component:

```tsx
export default function App() {
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const counterState = useStore(getOrCreateCounterStoreByKey(`tab-${currentTabIndex}`));

  return (
    <div style={{ fontFamily: "monospace" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={() => setCurrentTabIndex(0)}>Tab 1</button>
        <button onClick={() => setCurrentTabIndex(1)}>Tab 2</button>
        <button onClick={() => setCurrentTabIndex(2)}>Tab 3</button>
      </div>
      <div style={{ padding: 4 }}>
        Content of Tab {currentTabIndex + 1}
        <br />
        <button type="button" onClick={() => counterState.increment()}>
          Count: {counterState.count}
        </button>
      </div>
    </div>
  );
}
```

### Using Scoped (Non-Global) Vanilla Stores with Context

For isolated store instances per component tree, combine with React Context:

```tsx
import { createContext, useContext, useState, ReactNode } from "react";
import { createStore, useStore } from "zustand";

type PositionStore = {
  position: { x: number; y: number };
  setPosition: (nextPosition: PositionStore["position"]) => void;
};

const createPositionStore = () => {
  return createStore<PositionStore>()((set) => ({
    position: { x: 0, y: 0 },
    setPosition: (position) => set({ position }),
  }));
};

const PositionStoreContext = createContext<ReturnType<typeof createPositionStore> | null>(null);

function PositionStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createPositionStore());
  return <PositionStoreContext.Provider value={store}>{children}</PositionStoreContext.Provider>;
}

function usePositionStore<U>(selector: (state: PositionStore) => U) {
  const store = useContext(PositionStoreContext);

  if (store === null) {
    throw new Error("usePositionStore must be used within PositionStoreProvider");
  }

  return useStore(store, selector);
}

function MovingDot({ color }: { color: string }) {
  const position = usePositionStore((state) => state.position);
  const setPosition = usePositionStore((state) => state.setPosition);

  return (
    <div
      onPointerMove={(e) => {
        setPosition({
          x: e.clientX,
          y: e.clientY,
        });
      }}
      style={{
        position: "relative",
        width: "50vw",
        height: "100vh",
      }}
    >
      <div
        style={{
          position: "absolute",
          backgroundColor: color,
          borderRadius: "50%",
          transform: `translate(${position.x}px, ${position.y}px)`,
          left: -10,
          top: -10,
          width: 20,
          height: 20,
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <div style={{ display: "flex" }}>
      <PositionStoreProvider>
        <MovingDot color="red" />
      </PositionStoreProvider>
      <PositionStoreProvider>
        <MovingDot color="blue" />
      </PositionStoreProvider>
    </div>
  );
}
```

## Key Differences from `create`

| Feature           | `create`    | `createStore` + `useStore` |
| ----------------- | ----------- | -------------------------- |
| Returns           | React Hook  | Vanilla store + hook       |
| Provider needed   | No          | No (but can use Context)   |
| Use case          | React-first | Framework-agnostic         |
| Bundle size       | Smaller     | Slightly larger            |
| Instance per tree | One global  | Can isolate with Context   |

## When to Use `useStore`

Use `useStore` when you:

- Want vanilla stores that aren't tied to React
- Need to share stores across frameworks
- Want complete control over store instantiation
- Prefer using React Context for scoped instances
- Have complex initialization logic for stores
