## [Container queries support](#container-queries-support)

You can now use [container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries) with Mantine components. `rem` and `em` functions from [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/#remem-functions) are available in container queries staring from `postcss-preset-mantine@1.13.0`.

Resize parent element to see container query in action

## [RadarChart component](#radarchart-component)

New [RadarChart](https://mantine.dev/charts/radar-chart/) component:

ApplesOrangesTomatoesGrapesBananasLemons04080120160

## [FocusTrap.InitialFocus component](#focustrapinitialfocus-component)

[FocusTrap.InitialFocus](https://mantine.dev/core/focus-trap/) is a new component that adds a visually hidden element which will receive the focus when the focus trap is activated. Once `FocusTrap.InitialFocus` loses focus, it is removed from the tab order.

For example, it is useful if you do not want to focus any elements inside the [Modal](https://mantine.dev/core/modal/) when it is opened:

## [New MantineProvider props](#new-mantineprovider-props)

[MantineProvider](https://mantine.dev/theming/mantine-provider/) now includes more props to control how styles are generated and injected. These props are useful if you use Mantine as a headless library and in test environments.

### [deduplicateCssVariables](#deduplicatecssvariables)

`deduplicateCssVariables` prop determines whether CSS variables should be deduplicated: if a CSS variable has the same value as in the default theme, it is not added in the runtime. By default, it is set to `true`. If set to `false`, all Mantine CSS variables will be added in `<style />` tag, even if they have the same value as in the default theme.

### [withStaticClasses](#withstaticclasses)

`withStaticClasses` determines whether components should have static classes, for example, `mantine-Button-root`. By default, static classes are enabled, to disable them set `withStaticClasses` to `false`:

### [withGlobalClasses](#withglobalclasses)

`withGlobalClasses` determines whether global classes should be added with `<style />` tag. Global classes are required for `hiddenFrom`/`visibleFrom` and `lightHidden`/`darkHidden` props to work. By default, global classes are enabled, to disable them set `withGlobalClasses` to `false`. Note that disabling global classes may break styles of some components.

## [HeadlessMantineProvider](#headlessmantineprovider)

`HeadlessMantineProvider` is an alternative to [MantineProvider](https://mantine.dev/theming/mantine-provider/) that should be used when you want to use Mantine as a headless UI library. It removes all features that are related to Mantine styles:

- Mantine classes are not applied to components
- Inline CSS variables are not added with `style` attribute
- All color scheme related features are removed
- Global styles are not generated

Limitations of `HeadlessMantineProvider`:

- [Color scheme switching](https://mantine.dev/theming/color-schemes/) will not work. If your application has a dark mode, you will need to implement it on your side.
- Props that are related to styles in all components (`color`, `radius`, `size`, etc.) will have no effect.
- Some components that rely on styles will become unusable ([Grid](https://mantine.dev/core/grid/), [SimpleGrid](https://mantine.dev/core/simple-grid/), [Container](https://mantine.dev/core/container/), etc.).
- `lightHidden`/`darkHidden`, `visibleFrom`/`hiddenFrom` props will not work.
- [Style props](https://mantine.dev/styles/style-props/) will work only with explicit values, for example `mt="xs"` will not work, but `mt={5}` will.

To use `HeadlessMantineProvider`, follow the [getting started guide](https://mantine.dev/getting-started/) and replace `MantineProvider` with `HeadlessMantineProvider`. Note that you do not need to use [ColorSchemeScript](https://mantine.dev/theming/color-schemes/#colorschemescript) in your application, it will not have any effect, you can ignore this part of the guide.

## [Sparkline trendColors](#sparkline-trendcolors)

[Sparkline](https://mantine.dev/charts/sparkline/) now supports `trendColors` prop to change chart color depending on the trend. The prop accepts an object with `positive`, `negative` and `neutral` properties:

- `positive` - color for positive trend (first value is less than the last value in `data` array)
- `negative` - color for negative trend (first value is greater than the last value in `data` array)
- `neutral` - color for neutral trend (first and last values are equal)

`neutral` is optional, if not provided, the color will be the same as `positive`.

Positive trend:

Negative trend:

Neutral trend:

## [RichTextEditor tasks extension](#richtexteditor-tasks-extension)

[RichTextEditor](https://mantine.dev/x/tiptap/#tasks) now supports tasks [tiptap extension](https://tiptap.dev/docs/editor/api/nodes/task-list):

- A list item

- And another one

## [renderOption prop](#renderoption-prop)

[Select](https://mantine.dev/core/select/), [MultiSelect](https://mantine.dev/core/multi-select/), [TagsInput](https://mantine.dev/inputs/tags-input/) and [Autocomplete](https://mantine.dev/inputs/autocomplete/) components now support `renderOption` prop that allows to customize option rendering:

Select with renderOption

## [Styles improvements](#styles-improvements)

All Mantine components have been migrated to [logical CSS properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values) (as a replacement for rtl styles) and [:where](https://developer.mozilla.org/en-US/docs/Web/CSS/:where) pseudo-class (as a replacement for [private CSS variables](https://help.mantine.dev/q/private-css-variables)). These changes should not impact the usage of Mantine components, but now Mantine CSS files have smaller size. For example, `@mantine/core/styles.css` now has ~ 8% smaller size (192kb -> 177kb).

## [Pass props to inner recharts components](#pass-props-to-inner-recharts-components)

You can now pass props down to recharts [Bar](https://recharts.org/en-US/api/Bar), [Area](https://recharts.org/en-US/api/Area) and [Line](https://recharts.org/en-US/api/Line) components with `barProps`, `areaProps` and `lineProps` props on [BarChart](https://mantine.dev/charts/bar-chart/), [AreaChart](https://mantine.dev/charts/area-chart/) and [LineChart](https://mantine.dev/charts/line-chart/) components.

All props accept either an object with props or a function that receives series data as an argument and returns an object with props.

## [PieChart percent labels](#piechart-percent-labels)

[PieChart](https://mantine.dev/charts/pie-chart/) now supports `percent` labels:

400300300200

With labels line

Labels position

Inside

Outside

Labels type

Value

Percent

## [Documentation updates](#documentation-updates)

- [Responsive styles guide](https://mantine.dev/styles/responsive/) now includes new sections about responsive props and container queries
- New [HeadlessMantineProvider section](https://mantine.dev/styles/unstyled/#headlessmantineprovider) in the unstyled guide
- [ActionIcon](https://mantine.dev/core/action-icon/) now includes additional documentation section on how to make the button the same size as Mantine inputs
- [AreaChart](https://mantine.dev/charts/area-chart/) now includes an example of how to rotate x-axis labels
- [Redwood guide](https://mantine.dev/guides/redwood/) has been updated to the latest redwood version with Vite

## [Help center updates](#help-center-updates)

New articles added to the [help center](https://help.mantine.dev/):

- [Browser zooms in when input is focused. What should I do?](https://help.mantine.dev/q/browser-zooms-on-focus)
- [It is not possible to pinch to zoom when Modal is opened. What should I do?](https://help.mantine.dev/q/pinch-to-zoom-modal)
- [How can I lock scroll in my application?](https://help.mantine.dev/q/how-to-lock-scroll)
- [Where can I find the roadmap?](https://help.mantine.dev/q/roadmap)
- [How can I change Tabs border color?](https://help.mantine.dev/q/tabs-border-color)
- [How can I change inputs focus styles?](https://help.mantine.dev/q/input-focus-styles)
- [Can I use Mantine with Emotion/styled-components/tailwindcss?](https://help.mantine.dev/q/third-party-styles)
- [Is there a way to add mask to Mantine input?](https://help.mantine.dev/q/input-mask)
- [How to align input with a button in a flex container?](https://help.mantine.dev/q/align-input-button)
- [How can I change component color prop value depending on the color scheme?](https://help.mantine.dev/q/color-scheme-color)

## [Other changes](#other-changes)

- [use-list-state](https://mantine.dev/hooks/use-list-state/) hook now supports `swap` handler
- `form.setFieldValue` now supports callback function as an argument
- `px`, `py`, `mx` and `my` [style props](https://mantine.dev/styles/style-props/) now use logical CSS properties `padding-inline`, `padding-block`, `margin-inline` and `margin-block` instead of `padding-left`, `padding-right`, etc.
- All components now support `me`, `ms`, `ps`, `pe` [style props](https://mantine.dev/styles/style-props/) to set `margin-inline-end`, `margin-inline-start`, `padding-inline-start` and `padding-inline-end` CSS properties
- [Tooltip](https://mantine.dev/core/tooltip/), [Popover](https://mantine.dev/core/popover/) and other components based on `Popover` now support `floatingStrategy` prop to control [Floating UI strategy](https://floating-ui.com/docs/usefloating#strategy)
- All `@mantine/charts` components now support `children` prop, which passes children to the root recharts component
- [use-resize-observer](https://mantine.dev/hooks/use-resize-observer/) and [use-element-size](https://mantine.dev/hooks/use-element-size/) hooks now support [ResizeObserver options](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver/observe#parameters) as hook argument
- [Select](https://mantine.dev/core/select/), [MultiSelect](https://mantine.dev/core/multi-select/) and [TagsInput](https://mantine.dev/inputs/tags-input/) now support `onClear` prop, the function is called when clear button is clicked
- [MultiSelect](https://mantine.dev/core/multi-select/) and [TagsInput](https://mantine.dev/inputs/tags-input/) now support `onRemove` prop, the function is called with removed item value when one of the items is deselected
- [Redwood template](https://github.com/mantinedev/redwood-template) has been updated to the latest redwood version with Vite
