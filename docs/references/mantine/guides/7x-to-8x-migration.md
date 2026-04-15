## [Global styles imports](#global-styles-imports)

If you used separate styles imports from `@mantine/core/styles/global.css`, you need to update imports to use new files. Note that if you previously imported `@mantine/core/styles.css`, no changes are required – all new files are already included in `styles.css`.

7.x version import:

8.x version import:

If you used `@mantine/core/styles.css`, no changes are required; the import works the same in 7.x and 8.x versions:

## [Portal reuseTargetNode](#portal-reusetargetnode)

The `reuseTargetNode` prop of the [Portal](https://mantine.dev/core/portal/) component is now enabled by default. This option improves performance by reusing the target node between portal renders, but in some edge cases, it might cause issues with `z-index` stacking context.

If you experience issues with `z-index`, change the `reuseTargetNode` prop to `false` in theme:

## [Switch withThumbIndicator](#switch-withthumbindicator)

The [Switch](https://mantine.dev/core/switch/) component's default styles have been updated; it now includes a checked state indicator inside the thumb. If you want to use the old styles without the indicator, set the `withThumbIndicator` prop to `false` in the theme:

## [Date string values](#date-string-values)

`@mantine/dates` components now use date string values in `onChange` and other callbacks. If you want to continue using `@mantine/dates` components the same way as in 7.x, you need to convert callback values to `Date` objects:

## [DatesProvider timezone](#datesprovider-timezone)

The `DatesProvider` component no longer supports the `timezone` option:

If you need to handle timezones in your application, you can use a dedicated date library ([dayjs](https://day.js.org/), [luxon](https://moment.github.io/luxon/#/), [date-fns](https://date-fns.org/)) to update timezone values. Example of using Mantine components with [dayjs](https://day.js.org/):

## [DateTimePicker timeInputProps](#datetimepicker-timeinputprops)

The [DateTimePicker](https://mantine.dev/dates/date-time-picker/) component no longer accepts the `timeInputProps` prop, as the underlying [TimeInput](https://mantine.dev/dates/time-input/) component was replaced with [TimePicker](https://mantine.dev/dates/time-picker/). To pass props down to the [TimePicker](https://mantine.dev/dates/time-picker/) component, use the `timePickerProps` prop instead.

7.x version:

8.x version:

## [CodeHighlight usage](#codehighlight-usage)

The [@mantine/code-highlight](https://mantine.dev/x/code-highlight/) package no longer depends on [highlight.js](https://highlightjs.org/). You can follow the [updated documentation](https://mantine.dev/x/code-highlight/) to set up syntax highlighting with [shiki](https://shiki.matsu.io/).

If you want to continue using [highlight.js](https://highlightjs.org/) in your application, install the `highlight.js` package:

Then wrap your app with `CodeHighlightAdapterProvider` and provide `createHighlightJsAdapter` as the `adapter` prop:

Then you need to add styles from one of the highlight.js themes to your application. You can do that by importing a CSS file from the `highlight.js` package or adding it via a CDN link to the head of your application:

After that, you can use the `CodeHighlight` component in your application the same way you did in the 7.x version.

## [Menu data-hovered attribute](#menu-data-hovered-attribute)

[Menu.Item](https://mantine.dev/core/menu/) no longer uses the `data-hovered` attribute to indicate hovered state. If you used `data-hovered` in your styles, you need to change it to `:hover` and `:focus` selectors instead:

## [Popover hideDetached](#popover-hidedetached)

[Popover](https://mantine.dev/core/popover/) now supports the `hideDetached` prop to automatically close the popover when the target element is removed from the DOM:

By default, `hideDetached` is enabled – the behavior has changed from the 7.x version. If you prefer to keep the old behavior, you can disable `hideDetached` for all components:

## [Carousel changes](#carousel-changes)

Starting from the 8.x version, the [@mantine/carousel](https://mantine.dev/x/carousel/) package requires `embla-carousel` and `embla-carousel-react` packages with version 8.x.

You need to update embla dependencies:

Update embla props that were previously passed to the `Carousel` component to `emblaOptions`. Full list of props:

- `loop`
- `align`
- `slidesToScroll`
- `dragFree`
- `inViewThreshold`
- `skipSnaps`
- `containScroll`
- `speed` and `draggable` props were removed – they are no longer supported by embla

The `useAnimationOffsetEffect` hook was removed; it is no longer required, and you need to remove it from your code:

The `Embla` type is no longer exported from the `@mantine/carousel` package; you need to change this import to reference the `embla-carousel` package instead:
