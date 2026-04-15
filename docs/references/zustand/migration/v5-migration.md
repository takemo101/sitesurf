# Migrating from v4 to v5

We recommend updating to the latest version of v4 first, which will show all deprecation warnings without breaking your app.

## Changes in v5

- Drop default exports
- Drop deprecated features
- Make React 18 the minimum required version
- Make TypeScript 4.5 the minimum required version
- Drop UMD/SystemJS support
- Drop ES5 support
- Stricter types when `setState`'s replace flag is set
- Persist middleware behavioral change
- Other small breaking changes

## Migration Guide

### Using Custom Equality Functions

The `create` function in v5 does not support customizing equality functions. If you use custom equality like `shallow`, use `createWithEqualityFn` instead.

**v4:**

```js
import { create } from "zustand";
import { shallow } from "zustand/shallow";

const useCountStore = create((set) => ({
  count: 0,
  text: "hello",
}));

const Component = () => {
  const { count, text } = useCountStore(
    (state) => ({
      count: state.count,
      text: state.text,
    }),
    shallow,
  );
};
```

**v5 - Option 1: Use `createWithEqualityFn`**

First install the peer dependency:

```bash
npm install use-sync-external-store
```

Then:

```js
import { createWithEqualityFn as create } from "zustand/traditional";

// Rest of code stays the same
```

**v5 - Option 2: Use `useShallow` hook**

```js
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

const useCountStore = create((set) => ({
  count: 0,
  text: "hello",
}));

const Component = () => {
  const { count, text } = useCountStore(
    useShallow((state) => ({
      count: state.count,
      text: state.text,
    })),
  );
};
```

### Requiring Stable Selector Outputs

v5 matches React's default behavior: if a selector returns a new reference, it may cause infinite loops.

**❌ This may cause infinite loops in v5:**

```js
const [searchValue, setSearchValue] = useStore((state) => [
  state.searchValue,
  state.setSearchValue,
]);
```

Error message:

```
Uncaught Error: Maximum update depth exceeded. This can happen when a component
repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
```

**✅ Fix with `useShallow`:**

```js
import { useShallow } from "zustand/shallow";

const [searchValue, setSearchValue] = useStore(
  useShallow((state) => [state.searchValue, state.setSearchValue]),
);
```

**Another example - this may cause infinite loops:**

```js
const action = useMainStore((state) => {
  return state.action ?? () => {}
})
```

**✅ Fix - return stable reference:**

```js
const FALLBACK_ACTION = () => {};

const action = useMainStore((state) => {
  return state.action ?? FALLBACK_ACTION;
});
```

Or use `createWithEqualityFn`:

```js
import { createWithEqualityFn as create } from "zustand/traditional";
```

### Stricter Types with `replace` Flag (TypeScript Only)

The `replace` flag now has stricter typing to ensure complete state objects:

```ts
// Partial state update (valid)
store.setState({ key: "value" });

// Complete state replacement (valid)
store.setState({ key: "value" }, true);

// Incomplete state replacement (invalid) ❌
store.setState({}, true); // Error: Type '{}' is not assignable to type 'T'
```

**Handling dynamic `replace` flag:**

```ts
const replaceFlag = Math.random() > 0.5;
const args = [{ bears: 5 }, replaceFlag] as Parameters<typeof useBearStore.setState>;
store.setState(...args);
```

### Persist Middleware - No Longer Stores on Creation

**v4:** Initial state was stored during creation:

```js
const useCountStore = create(
  persist(
    () => ({
      count: Math.floor(Math.random() * 1000),
    }),
    {
      name: "count",
    },
  ),
);
```

**v5:** Explicitly set the state after creation:

```js
const useCountStore = create(
  persist(
    () => ({
      count: 0,
    }),
    {
      name: "count",
    },
  ),
);

useCountStore.setState({
  count: Math.floor(Math.random() * 1000),
});
```

## Detailed Changes

### Default Exports Removed

**v4:**

```js
import create from "zustand";
```

**v5:**

```js
import { create } from "zustand";
```

### React 18 Required

v5 requires React 18 or higher. If you're on React 17 or earlier, stay on v4.

### TypeScript 4.5+ Required

v5 requires TypeScript 4.5 or higher for type inference improvements.

### New Entry Points

```js
// Core
import { create, createStore } from "zustand";

// React integration (vanilla stores in React)
import { useStore } from "zustand";

// Traditional API (with equality functions)
import { createWithEqualityFn } from "zustand/traditional";

// Middleware
import {
  persist,
  immer,
  redux,
  devtools,
  combine,
  subscribeWithSelector,
} from "zustand/middleware";

// Utilities
import { shallow, useShallow } from "zustand/shallow";
```

## Verification Checklist

- [ ] Updated `zustand` to v5
- [ ] Removed default imports (`import create from 'zustand'` → `import { create } from 'zustand'`)
- [ ] Fixed custom equality functions (use `createWithEqualityFn` or `useShallow`)
- [ ] Ensured selector functions return stable references
- [ ] Fixed `setState` calls with `replace: true` flag
- [ ] Updated `persist` middleware usage if using initial state setting
- [ ] Tested with React 18+
- [ ] Run TypeScript compiler to catch type errors

## Related Links

- [v5 Migration PR](https://github.com/pmndrs/zustand/pull/2138)
- [Type Safety PR](https://github.com/pmndrs/zustand/pull/2580)
