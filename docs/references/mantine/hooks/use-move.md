## [Usage](#usage)

The `use-move` hook handles move behavior over any element:

Values `{ x: 20, y: 60 }`

## [API](#api)

The hook accepts a callback that is called when the user moves the pressed mouse over the given element and returns an object with `ref` and active state:

The `x` and `y` values are always between `0` and `1`; you can use them to calculate the value in your boundaries.

## [Horizontal slider](#horizontal-slider)

You can ignore changes for one of the axis:

Value: 20

## [Horizontal slider with styles](#horizontal-slider-with-styles)

30

70

## [Vertical slider](#vertical-slider)

Moving the slider down increases the value, to reverse that set value to `1 - y` in your `setValue` function:

Value: 20

## [Color picker](#color-picker)

## [clampUseMovePosition](#clampusemoveposition)

`clampUseMovePosition` function can be used to clamp `x` and `y` values to `0-1` range. It is useful when you want to use external events to change the value, for example changing value with keyboard arrows:

## [UseMovePosition](#usemoveposition)

`@mantine/hooks` exports `UseMovePosition` type, it can be used as a type parameter for `useState`:

## [Definition](#definition)

## [Exported types](#exported-types)

`UseMovePosition`, `UseMoveReturnValue` and `UseMoveHandlers` types are exported from the `@mantine/hooks` package; you can import them in your application:
