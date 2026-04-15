# Zustand Comparison with Other Libraries

Zustand is one of many state management libraries for React. This guide compares Zustand to Redux, Valtio, Jotai, and Recoil, discussing key differences and similarities.

## Redux

### State Model

Conceptually, Zustand and Redux are quite similar—both based on an immutable state model. However, Redux requires your app to be wrapped in context providers; Zustand does not.

**Zustand:**

```ts
import { create } from "zustand";

type State = {
  count: number;
};

type Actions = {
  increment: (qty: number) => void;
  decrement: (qty: number) => void;
};

type CountStore = State & Actions;

const useCountStore = create<CountStore>((set) => ({
  count: 0,
  increment: (qty: number) => set((state) => ({ count: state.count + qty })),
  decrement: (qty: number) => set((state) => ({ count: state.count - qty })),
}));
```

**Redux with Thunk:**

```ts
import { createStore } from "redux";
import { useSelector, useDispatch } from "react-redux";

type State = {
  count: number;
};

type Action = {
  type: "increment" | "decrement";
  qty: number;
};

const countReducer = (state: State, action: Action) => {
  switch (action.type) {
    case "increment":
      return { count: state.count + action.qty };
    case "decrement":
      return { count: state.count - action.qty };
    default:
      return state;
  }
};

const countStore = createStore(countReducer);
```

### Render Optimization

When it comes to render optimizations, there are no major differences. Both libraries recommend manually applying render optimizations using selectors.

**Zustand Optimization:**

```ts
const Component = () => {
  const count = useCountStore((state) => state.count);
  const increment = useCountStore((state) => state.increment);
  const decrement = useCountStore((state) => state.decrement);
};
```

## Valtio

### State Model

Zustand and Valtio approach state management fundamentally differently:

- **Zustand**: Based on the **immutable** state model
- **Valtio**: Based on the **mutable** state model

**Zustand (Immutable):**

```ts
const store = create<State>(() => ({ obj: { count: 0 } }));
store.setState((prev) => ({ obj: { count: prev.obj.count + 1 } }));
```

**Valtio (Mutable):**

```ts
import { proxy } from "valtio";

const state = proxy({ obj: { count: 0 } });
state.obj.count += 1;
```

### Render Optimization

- **Zustand**: Requires manual render optimizations using selectors
- **Valtio**: Makes render optimizations through property access

## Jotai

### State Model

The major difference:

- **Zustand**: A single store containing all state
- **Jotai**: Primitive atoms that compose together

**Zustand:**

```ts
type Actions = {
  updateCount: (countCallback: (count: number) => number) => void;
};

const useCountStore = create<State & Actions>((set) => ({
  count: 0,
  updateCount: (countCallback) => set((state) => ({ count: countCallback(state.count) })),
}));
```

**Jotai:**

```ts
import { atom } from "jotai";

const countAtom = atom<number>(0);
```

### Render Optimization

- **Jotai**: Achieves render optimization through atom dependency
- **Zustand**: Requires manual optimization via selectors

**Zustand Optimization:**

```ts
const Component = () => {
  const count = useCountStore((state) => state.count);
  const updateCount = useCountStore((state) => state.updateCount);
};
```

## Recoil

### State Model

Recoil is similar to Jotai but depends on atom string keys instead of object references. Additionally, Recoil needs to wrap your app in a context provider.

**Zustand:**

```ts
const useCountStore = create<State & Actions>((set) => ({
  count: 0,
  setCount: (countCallback) => set((state) => ({ count: countCallback(state.count) })),
}));
```

**Recoil:**

```ts
import { atom } from "recoil";

const count = atom({
  key: "count",
  default: 0,
});
```

### Render Optimization

- **Recoil**: Makes optimizations through atom dependency
- **Zustand**: Requires manual optimization via selectors

## Summary

| Feature             | Zustand   | Redux     | Valtio  | Jotai | Recoil |
| ------------------- | --------- | --------- | ------- | ----- | ------ |
| State Model         | Immutable | Immutable | Mutable | Atoms | Atoms  |
| Requires Providers  | No        | Yes       | No      | No    | Yes    |
| Manual Optimization | Yes       | Yes       | No      | No    | No     |
| Minimal Boilerplate | Yes       | No        | Yes     | Yes   | Yes    |
| Learning Curve      | Low       | Medium    | Low     | Low   | Medium |

## NPM Downloads Trend

You can view the [npm downloads trend comparison](https://npm-stat.com/charts.html?package=zustand&package=jotai&package=valtio&package=%40reduxjs%2Ftoolkit&package=recoil) of state management libraries.
