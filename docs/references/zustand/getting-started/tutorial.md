# Tutorial: Building a Tic-Tac-Toe Game

In this tutorial, you'll build an interactive tic-tac-toe game with React and Zustand. This tutorial assumes existing React knowledge and teaches fundamental React and Zustand concepts through hands-on experience.

## What You're Building

You'll create a complete tic-tac-toe game with:

- A 3x3 game board
- Turn-based gameplay (X and O players)
- Winner detection
- Game history and time travel
- Move navigation

## Core Components

### Square Component

The `Square` component represents a single cell in the board:

```jsx
function Square({ value, onSquareClick }) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        backgroundColor: "#fff",
        border: "1px solid #999",
        outline: 0,
        borderRadius: 0,
        fontSize: "1rem",
        fontWeight: "bold",
      }}
      onClick={onSquareClick}
    >
      {value}
    </button>
  );
}
```

### Board Component

The `Board` component manages a 3x3 grid of squares and game logic:

```jsx
function Board({ xIsNext, squares, onPlay }) {
  const winner = calculateWinner(squares);
  const turns = calculateTurns(squares);
  const player = xIsNext ? "X" : "O";
  const status = calculateStatus(winner, turns, player);

  function handleClick(i) {
    if (squares[i] || winner) return;
    const nextSquares = squares.slice();
    nextSquares[i] = player;
    onPlay(nextSquares);
  }

  return (
    <>
      <div style={{ marginBottom: "0.5rem" }}>{status}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          width: "calc(3 * 2.5rem)",
          height: "calc(3 * 2.5rem)",
          border: "1px solid #999",
        }}
      >
        {squares.map((square, squareIndex) => (
          <Square
            key={`square-${squareIndex}`}
            value={squares[squareIndex]}
            onSquareClick={() => handleClick(squareIndex)}
          />
        ))}
      </div>
    </>
  );
}
```

## State Management with Zustand

Create a store to manage game history and current move:

```ts
import { create } from "zustand";
import { combine } from "zustand/middleware";

const useGameStore = create(
  combine(
    {
      history: [Array(9).fill(null)],
      currentMove: 0,
    },
    (set) => ({
      setHistory: (nextHistory) => {
        set((state) => ({
          history: typeof nextHistory === "function" ? nextHistory(state.history) : nextHistory,
        }));
      },
      setCurrentMove: (nextCurrentMove) => {
        set((state) => ({
          currentMove:
            typeof nextCurrentMove === "function"
              ? nextCurrentMove(state.currentMove)
              : nextCurrentMove,
        }));
      },
    }),
  ),
);
```

## Game Component

The `Game` component controls the overall game flow and time travel:

```jsx
export default function Game() {
  const history = useGameStore((state) => state.history);
  const setHistory = useGameStore((state) => state.setHistory);
  const currentMove = useGameStore((state) => state.currentMove);
  const setCurrentMove = useGameStore((state) => state.setCurrentMove);
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove];

  function handlePlay(nextSquares) {
    const nextHistory = history.slice(0, currentMove + 1).concat([nextSquares]);
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
  }

  function jumpTo(nextMove) {
    setCurrentMove(nextMove);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        fontFamily: "monospace",
      }}
    >
      <div>
        <Board xIsNext={xIsNext} squares={currentSquares} onPlay={handlePlay} />
      </div>
      <div style={{ marginLeft: "1rem" }}>
        <ol>
          {history.map((_, historyIndex) => {
            const description =
              historyIndex > 0 ? `Go to move #${historyIndex}` : "Go to game start";

            return (
              <li key={historyIndex}>
                <button onClick={() => jumpTo(historyIndex)}>{description}</button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
```

## Helper Functions

### Calculate Winner

```ts
function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }

  return null;
}
```

### Calculate Remaining Turns

```ts
function calculateTurns(squares) {
  return squares.filter((square) => !square).length;
}
```

### Calculate Game Status

```ts
function calculateStatus(winner, turns, player) {
  if (!winner && !turns) return "Draw";
  if (winner) return `Winner: ${winner}`;
  return `Next player: ${player}`;
}
```

## Key Concepts Learned

1. **State Lifting**: Moving state to a parent component (Game) for shared data
2. **Immutable Updates**: Using `.slice()` to create new array copies instead of mutation
3. **Component Communication**: Passing callbacks (props) between parent and child components
4. **State Management**: Using Zustand to persist game history
5. **Time Travel**: Storing and navigating game history
6. **Conditional Rendering**: Showing different UI based on game state

## What's Next

This tutorial provides the foundation for understanding:

- How to structure Zustand stores for complex applications
- Managing game or application state across multiple components
- Implementing undo/redo functionality
- Building interactive React applications with state management
