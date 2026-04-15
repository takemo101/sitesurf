# create API

The `create` function lets you create a React Hook with API utilities attached.

```js
const useSomeStore = create(stateCreatorFn);
```

## Signature

```ts
create<T>()(stateCreatorFn: StateCreator<T, [], []>): UseBoundStore<StoreApi<T>>
```

## Reference

### `create(stateCreatorFn)`

#### Parameters

- `stateCreatorFn`: A function that takes `set`, `get`, and `store` as arguments. Usually returns an object with methods you want to expose.

#### Returns

`create` returns a React Hook with API utilities: `setState`, `getState`, `getInitialState`, and `subscribe` attached. It lets you return data based on current state using a selector function.

## Usage Examples

### Basic Store Creation

```ts
import { create } from "zustand";

type State = {
  count: number;
  increment: () => void;
};

const useCountStore = create<State>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### Using in Components

```jsx
function Counter() {
  const count = useCountStore((state) => state.count);
  const increment = useCountStore((state) => state.increment);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}
```

## Advanced Patterns

### Updating State Based on Previous State

To update state based on previous state, use updater functions:

```ts
type AgeStoreState = { age: number };

type AgeStoreActions = {
  setAge: (
    nextAge: AgeStoreState["age"] | ((currentAge: AgeStoreState["age"]) => AgeStoreState["age"]),
  ) => void;
};

const useAgeStore = create<AgeStoreState & AgeStoreActions>()((set) => ({
  age: 42,
  setAge: (nextAge) => {
    set((state) => ({
      age: typeof nextAge === "function" ? nextAge(state.age) : nextAge,
    }));
  },
}));
```

### Updating Primitives

For primitive values like numbers or strings, directly assign new values:

```ts
type XStore = number;

const useXStore = create<XStore>()(() => 0);

const setX = (nextX: number) => {
  useXStore.setState(nextX, true); // replace: true
};
```

### Updating Objects

Objects must be treated as immutable. Create new objects instead of mutating:

```ts
type PositionStoreState = { position: { x: number; y: number } };

type PositionStoreActions = {
  setPosition: (nextPosition: PositionStoreState["position"]) => void;
};

const usePositionStore = create<PositionStoreState & PositionStoreActions>()((set) => ({
  position: { x: 0, y: 0 },
  setPosition: (nextPosition) => set({ position: nextPosition }),
}));
```

### Updating Arrays

Arrays must be treated as immutable. Use immutable array operations:

```ts
type PositionStore = [number, number];

const usePositionStore = create<PositionStore>()(() => [0, 0]);

const setPosition = (nextPosition: PositionStore) => {
  usePositionStore.setState(nextPosition, true);
};
```

Prefer immutable operations like: `[...array]`, `concat()`, `filter()`, `slice()`, `map()`, `toSpliced()`, `toSorted()`, and `toReversed()`. Avoid: `array[index] = value`, `push()`, `unshift()`, `pop()`, `shift()`, `splice()`, `reverse()`, `sort()`.

### Updating State Without Store Actions

You can define actions outside the store for code organization:

```ts
const usePositionStore = create<{ x: number; y: number }>()(() => ({ x: 0, y: 0 }));

const setPosition = (nextPosition: { x: number; y: number }) => {
  usePositionStore.setState(nextPosition);
};
```

### Subscribing to State Updates

Subscribe to state changes using the `subscribe` method:

```ts
useEffect(() => {
  const unsubscribe = usePositionStore.subscribe(({ position }) => {
    console.log("position updated:", position);
  });

  return () => {
    unsubscribe();
  };
}, []);
```

## Troubleshooting

### State Updates Not Triggering Re-renders

If you've updated state but the screen doesn't update, ensure you're not mutating state. Always create new objects/arrays:

```ts
// ❌ Wrong: Direct mutation
const handleChange = (e) => {
  person.firstName = e.target.value;
};

// ✅ Correct: Create new object
const handleChange = (e) => {
  setPerson({ ...person, firstName: e.target.value });
};
```

The `set` function performs a shallow merge by default. To completely replace state, use the `replace` parameter:

```ts
store.setState(newState, true); // Replace entire state
store.setState({ field: value }); // Merge with existing state
```
