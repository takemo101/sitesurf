## [Virtual colors](#virtual-colors)

Virtual color is a special color which values should be different for light and dark color schemes. To define a virtual color, use `virtualColor` function which accepts an object with the following properties as a single argument:

- `name` – color name, must be the same as the key in `theme.colors` object
- `light` – a key of `theme.colors` object for light color scheme
- `dark` – a key of `theme.colors` object for dark color scheme

To see the demo in action, switch between light and dark color schemes (`Ctrl + J`):

This box has virtual background color, it is pink in dark mode and cyan in light mode

## [FloatingIndicator component](#floatingindicator-component)

New [FloatingIndicator](https://mantine.dev/core/floating-indicator/) component:

## [ScatterChart component](#scatterchart-component)

New [ScatterChart](https://mantine.dev/charts/scatter-chart/) component:

## [colorsTuple function](#colorstuple-function)

New `colorsTuple` function can be used to:

- Use single color as the same color for all shades
- Transform dynamic string arrays to Mantine color tuple (the array should still have 10 values)

## [use-mutation-observer hook](#use-mutation-observer-hook)

New [useMutationObserver](https://mantine.dev/hooks/use-mutation-observer/) hook:

Press Ctrl + Shift + L to change direction

Direction was changed to: Not changed yet

## [use-state-history hook](#use-state-history-hook)

New [useStateHistory](https://mantine.dev/hooks/use-state-history/) hook:

Current value: 1

{
"history": \[
1
\],
"current": 0
}

## [Axis labels](#axis-labels)

[AreaChart](https://mantine.dev/charts/area-chart/), [BarChart](https://mantine.dev/charts/bar-chart/) and [LineChart](https://mantine.dev/charts/line-chart/) components now support `xAxisLabel` and `yAxisLabel` props:

## [Documentation updates](#documentation-updates)

- New section has been added to the [responsive guide](https://mantine.dev/styles/responsive/#hidden-and-visible-from-as-classes) on how to use `mantine-hidden-from-{x}` and `mantine-visible-from-{x}` classes.
- [Jest](https://mantine.dev/guides/jest/) and [Vitest](https://mantine.dev/guides/vitest/) guides configuration has been updated to include mocks for `window.HTMLElement.prototype.scrollIntoView`
- [CSS variables](https://mantine.dev/styles/css-variables/) documentation has been updated to include more information about typography and colors variables

## [Help center updates](#help-center-updates)

New articles added to the [help center](https://help.mantine.dev/):

- [Can I use SegmentedControl with empty value?](https://help.mantine.dev/q/segmented-control-no-value)
- [Is there a comparison with other libraries?](https://help.mantine.dev/q/other-libs)
- [Can I use Mantine with Vue/Svelte/Angular/etc.?](https://help.mantine.dev/q/vue-svelte-angular)
- [How can I test Select/MultiSelect components?](https://help.mantine.dev/q/combobox-testing)

## [Other changes](#other-changes)

- [SegmentedControl](https://mantine.dev/core/segmented-control/) indicator positioning logic has been migrated to [FloatingIndicator](https://mantine.dev/core/floating-indicator/). It is now more performant and works better when used inside elements with `transform: scale()`.
- New [use-mounted](https://mantine.dev/hooks/use-mounted/) hook
- [Sparkline](https://mantine.dev/charts/sparkline/) now supports `connectNulls` and `areaProps` props
- [Select](https://mantine.dev/core/select/), [MultiSelect](https://mantine.dev/core/multi-select/), [Autocomplete](https://mantine.dev/core/autocomplete/) and [TagsInput](https://mantine.dev/core/tags-input/) components now support `scrollAreaProps` prop to pass props down to the [ScrollArea](https://mantine.dev/core/scroll-area/) component in the dropdown
- [Transition](https://mantine.dev/core/transition/) component now supports 4 new transitions: `fade-up`, `fade-down`, `fade-left`, `fade-right`
- Default [Modal](https://mantine.dev/core/modal/) transition was changed to `fade-down`. This change resolves issues with [SegmentedControl](https://mantine.dev/core/segmented-control/) indicator positioning when used inside modals.
- You can now reference headings font sizes and line heights in `fz` and `lh` style props with `h1`, `h2`, `h3`, `h4`, `h5`, `h6` values
