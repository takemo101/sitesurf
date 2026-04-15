## [Support Mantine development](#support-mantine-development)

You can now sponsor Mantine development with [OpenCollective](https://opencollective.com/mantinedev). All funds are used to improve Mantine and create new features and components.

[Sponsor Mantine](https://opencollective.com/mantinedev)

## [DatePicker presets](#datepicker-presets)

[DatePicker](https://mantine.dev/dates/date-picker/), [DatePickerInput](https://mantine.dev/dates/date-picker-input/) and [DateTimePicker](https://mantine.dev/dates/date-time-picker/) now support `presets` prop that allows you to add custom date presets. Presets are displayed next to the calendar:

| Mo  | Tu  | We  | Th  | Fr  | Sa  | Su  |
| --- | --- | --- | --- | --- | --- | --- |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |

## [Calendar headerControlsOrder](#calendar-headercontrolsorder)

[Calendar](https://mantine.dev/dates/calendar/) and other components based on it now support `headerControlsOrder` prop. You can use `headerControlsOrder` prop to change the order of header controls. The prop accepts an array of `'next' | 'previous' | 'level'`. Note that each control can be used only once in the array.

| Mo  | Tu  | We  | Th  | Fr  | Sa  | Su  |
| --- | --- | --- | --- | --- | --- | --- |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |

## [Popover middlewares improvements](#popover-middlewares-improvements)

[Popover](https://mantine.dev/core/popover/) component now handles `shift` and `flip` Floating UI differently. Starting from 8.1.0 version, the popover dropdown position is not changed when the popover is opened. `shift` and `flip` middlewares are used only once to calculate the initial position of the dropdown.

This change fixes incorrect flipping/shifting behavior when there is dynamic content in the dropdown. For example, searchable [Select](https://mantine.dev/core/select/) and [DatePickerInput](https://mantine.dev/dates/date-picker-input/) without `consistentWeeks` option.

Previous behavior:

New behavior:

## [use-long-press hook](#use-long-press-hook)

New [use-long-press](https://mantine.dev/hooks/use-long-press/) hook:

## [Reference area support in charts](#reference-area-support-in-charts)

[BarChart](https://mantine.dev/charts/bar-chart/), [AreaChart](https://mantine.dev/charts/area-chart/) and [LineChart](https://mantine.dev/charts/line-chart/) components now support reference area. Reference area is a rectangular area that can be used to highlight a specific region of the chart:

## [use-form resetField handler](#use-form-resetfield-handler)

[use-form](https://mantine.dev/form/use-form/) now has a `resetField` method that resets field value to its initial value:

## [TagsInput isDuplicate prop](#tagsinput-isduplicate-prop)

You can now use `isDuplicate` prop in [TagsInput](https://mantine.dev/core/tags-input/) component to control how duplicates are detected. It is a function that receives two arguments: tag value and current tags. The function must return `true` if the value is duplicate.

Example of using `isDuplicate` to allow using the same value with different casing:

## [Slider domain prop](#slider-domain-prop)

[Slider](https://mantine.dev/core/slider/) component now supports `domain` prop that allows setting the possible range of values independently of the `min` and `max` values:

min

max

## [RangeSlider pushOnOverlap prop](#rangeslider-pushonoverlap-prop)

[RangeSlider](https://mantine.dev/core/range-slider/) component now supports `pushOnOverlap` prop that defines whether the slider should push the overlapping thumb when the user drags it.

## [Hooks types exports](#hooks-types-exports)

`@mantine/hooks` package now exports all types used in hooks options and return values. For example, you can now import [use-uncontrolled](https://mantine.dev/hooks/use-uncontrolled/) types like this:

Types exported from the library:

## [zod v4 with use-form](#zod-v4-with-use-form)

You can now use zod v4 with [use-form](https://mantine.dev/form/use-form/). To use zod 4:

- Update `mantine-form-zod-resolver` to `1.2.1` or later version
- Update zod to version `3.25.0` or later
- Replace `zod` imports with `zod/v4` (only if you have `zod@3` in your `package.json`)
- Replace `zodResolver` with `zod4Resolver` in your code
- All other code remains the same

Example with zod v4:

## [Documentation updates](#documentation-updates)

- [use-debounced-callback](https://mantine.dev/hooks/use-debounced-callback/) documentation was updated to include new `flush` and `flushOnUnmount` features
- Documentation about exported types was added to all applicable hooks

## [Other changes](#other-changes)

- All components now support `bdrs` style prop to set border radius.
- [DateTimePicker](https://mantine.dev/dates/date-time-picker/) now supports `defaultTimeValue` prop
- [Tooltip](https://mantine.dev/core/tooltip/) now supports `autoContrast` prop.
- Handlers returned from [use-counter](https://mantine.dev/hooks/use-counter/) are now memoized.
- Return value of [use-event-listener](https://mantine.dev/hooks/use-event-listener/), [use-focus-within](https://mantine.dev/hooks/use-focus-within/), [use-focus-trap](https://mantine.dev/hooks/use-focus-trap/), [use-hover](https://mantine.dev/hooks/use-hover/), [use-move](https://mantine.dev/hooks/use-move/), [use-radial-move](https://mantine.dev/hooks/use-radial-move/) changed (`React.RefObject` -> `React.RefCallback`), required to fix incorrect ref handling in several cases. For more information, see the issue on GitHub – [#7406](https://github.com/mantinedev/mantine/issues/7406).
- Deprecated `React.MutableRefObject` type was replaced with `React.RefObject` in all packages to better support React 19 types.
- `positionDependencies` prop is now deprecated in [Tooltip](https://mantine.dev/core/tooltip/), [Popover](https://mantine.dev/core/popover/) and other components based on Popover. The prop is no longer required and can be safely removed. `positionDependencies` prop will be removed in 9.0 release.
