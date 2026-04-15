## [Usage](#usage)

The `use-hotkeys` hook accepts an array of hotkeys and handler tuples as its first argument:

- `hotkey` - hotkey string, for example `ctrl+E`, `shift+alt+L`, `mod+S`
- `handler` - event handler called when the given combination is pressed
- `options` - object with extra options for the hotkey handler

Ctrl

-

K

–

Open search

Ctrl

-

J

–

Toggle color scheme

The second argument is a list of HTML tags on which hotkeys should be ignored. By default, hotkey events are ignored if the focus is in `input`, `textarea`, and `select` elements.

## [Targeting elements](#targeting-elements)

The `use-hotkeys` hook can only work with the document element; you will need to create your own event listener if you need to support other elements. For this purpose, the `@mantine/hooks` package exports a `getHotkeyHandler` function that should be used with `onKeyDown`:

Press ⌘+Enter or Ctrl+Enter when input has focus to send message

With `getHotkeyHandler` you can also add events to any DOM node using `.addEventListener`:

## [Supported formats](#supported-formats)

- `mod+S` – detects `⌘+S` on macOS and `Ctrl+S` on Windows
- `ctrl+shift+X` – handles multiple modifiers
- `alt + shift + L` – you can use whitespace inside hotkey
- `ArrowLeft` – you can use special keys using [this format](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values)
- `shift + [plus]` – you can use `[plus]` to detect `+` key
- `Digit1` and `Hotkey1` - you can use physical key assignments [defined on MDN](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values).

## [Types](#types)

The `@mantine/hooks` package exports `HotkeyItemOptions` and `HotkeyItem` types:

`HotkeyItemOptions` provides the `usePhysicalKeys` option to force physical key assignment. This is useful for non-QWERTY keyboard layouts.

The `HotkeyItem` type can be used to create hotkey items outside of the `use-hotkeys` hook:

## [Definition](#definition)

## [Exported types](#exported-types)

The `HotkeyItemOptions` and `HotkeyItem` types are exported from `@mantine/hooks`;
