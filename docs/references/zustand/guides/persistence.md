# State Persistence Guide

The `persist` middleware enables you to store your Zustand state in storage (e.g., `localStorage`, `sessionStorage`, `AsyncStorage`, `IndexedDB`), thus persisting its data across page reloads or application restarts.

This middleware supports both synchronous storages (like `localStorage`) and asynchronous storages (like `AsyncStorage`).

## Basic Persistence

### Simple Example

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useBearStore = create(
  persist(
    (set, get) => ({
      bears: 0,
      addABear: () => set({ bears: get().bears + 1 }),
    }),
    {
      name: "bear-storage", // unique name for storage key
    },
  ),
);
```

### TypeScript Example

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type BearStore = {
  bears: number;
  addABear: () => void;
};

export const useBearStore = create<BearStore>()(
  persist(
    (set, get) => ({
      bears: 0,
      addABear: () => set({ bears: get().bears + 1 }),
    }),
    {
      name: "food-storage",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
```

## Configuration Options

### `name` (Required)

The unique name of the item in storage:

```ts
persist(stateCreatorFn, {
  name: "my-store", // Must be unique across app
});
```

### `storage`

Specify a custom storage engine. Defaults to `createJSONStorage(() => localStorage)`:

```ts
persist(stateCreatorFn, {
  storage: createJSONStorage(() => sessionStorage),
});
```

### `partialize`

Filter state fields before persisting:

```ts
// Only persist specific fields
persist(stateCreatorFn, {
  partialize: (state) => ({ foo: state.foo }),
});

// Exclude specific fields
persist(stateCreatorFn, {
  partialize: (state) =>
    Object.fromEntries(Object.entries(state).filter(([key]) => !["transient"].includes(key))),
});
```

### `onRehydrateStorage`

Add listeners before and after state rehydration:

```ts
persist(stateCreatorFn, {
  onRehydrateStorage: (state) => {
    console.log("hydration starts");

    return (state, error) => {
      if (error) {
        console.log("an error happened during hydration", error);
      } else {
        console.log("hydration finished");
      }
    };
  },
});
```

### `version`

Version number for breaking changes in storage schema:

```ts
persist(stateCreatorFn, {
  version: 1,
});
```

### `migrate`

Handle migrations when schema changes:

```ts
persist(stateCreatorFn, {
  version: 1,
  migrate: (persistedState, version) => {
    if (version === 0) {
      // Rename field from oldField to newField
      persistedState.newField = persistedState.oldField;
      delete persistedState.oldField;
    }
    return persistedState;
  },
});
```

### `merge`

Custom merge logic for persisted state:

```ts
persist(stateCreatorFn, {
  merge: (persistedState, currentState) => deepMerge(currentState, persistedState),
});
```

### `skipHydration`

Skip initial hydration for server-rendered apps:

```ts
persist(stateCreatorFn, {
  skipHydration: true,
});
```

Then manually rehydrate:

```tsx
useEffect(() => {
  useBoundStore.persist.rehydrate();
}, []);
```

## Partial Persistence

Persist only part of the state:

```ts
type PositionStore = {
  context: {
    position: { x: number; y: number };
  };
  actions: {
    setPosition: (position: PositionStore["context"]["position"]) => void;
  };
};

const positionStore = create<PositionStore>(
  persist(
    (set) => ({
      context: {
        position: { x: 0, y: 0 },
      },
      actions: {
        setPosition: (position) => set({ context: { position } }),
      },
    }),
    {
      name: "position-storage",
      partialize: (state) => ({ context: state.context }), // Only persist context
    },
  ),
);
```

## Custom Storage Engine

Implement custom storage for any backend:

```ts
import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";

const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // Implementation for your storage
    return (await fetch(`/api/state/${name}`)).json();
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await fetch(`/api/state/${name}`, {
      method: "POST",
      body: value,
    });
  },
  removeItem: async (name: string): Promise<void> => {
    await fetch(`/api/state/${name}`, { method: "DELETE" });
  },
};

export const useBoundStore = create(
  persist(stateCreatorFn, {
    name: "food-storage",
    storage: createJSONStorage(() => storage),
  }),
);
```

## Handling Complex Types (Map, Set, Date)

Use custom serialization for types that JSON doesn't support:

```ts
import superjson from "superjson";

const storage: PersistStorage<BearState> = {
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    return superjson.parse(str);
  },
  setItem: (name, value) => {
    localStorage.setItem(name, superjson.stringify(value));
  },
  removeItem: (name) => localStorage.removeItem(name),
};

const useBearStore = create<BearState>(
  persist(stateCreatorFn, {
    name: "bear-storage",
    storage,
  }),
);
```

## Persist API

Access and control persistence:

### `getOptions()`

Get current persist options:

```ts
useBoundStore.persist.getOptions().name;
```

### `setOptions(newOptions)`

Change persist options:

```ts
useBoundStore.persist.setOptions({
  name: "new-name",
});
```

### `clearStorage()`

Clear persisted state:

```ts
useBoundStore.persist.clearStorage();
```

### `rehydrate()`

Manually trigger rehydration:

```ts
await useBoundStore.persist.rehydrate();
```

### `hasHydrated()`

Check if storage has been hydrated:

```ts
if (useBoundStore.persist.hasHydrated()) {
  // Use store
}
```

### `onHydrate(listener)`

Listen for hydration start:

```ts
const unsub = useBoundStore.persist.onHydrate((state) => {
  console.log("hydration starts");
});
```

### `onFinishHydration(listener)`

Listen for hydration completion:

```ts
const unsub = useBoundStore.persist.onFinishHydration((state) => {
  console.log("hydration finished");
});
```

## Next.js and SSR Handling

To avoid hydration mismatches in Next.js:

```ts
import { useState, useEffect } from "react";

const useStore = <T, F>(
  store: (callback: (state: T) => unknown) => unknown,
  callback: (state: T) => F,
) => {
  const result = store(callback) as F;
  const [data, setData] = useState<F>();

  useEffect(() => {
    setData(result);
  }, [result]);

  return data;
};

export default useStore;
```

Usage:

```ts
const bears = useStore(useBearStore, (state) => state.bears);
```

## FAQ

### How to Check if Store Has Hydrated

Using `onRehydrateStorage`:

```ts
const useBoundStore = create(
  persist(stateCreatorFn, {
    onRehydrateStorage: (state) => {
      return () => state.setHasHydrated(true);
    },
  }),
);
```

Or with a custom hook:

```ts
const useHydration = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubHydrate = useBoundStore.persist.onHydrate(() => setHydrated(false));
    const unsubFinishHydration = useBoundStore.persist.onFinishHydration(() => setHydrated(true));

    setHydrated(useBoundStore.persist.hasHydrated());

    return () => {
      unsubHydrate();
      unsubFinishHydration();
    };
  }, []);

  return hydrated;
};
```
