## [Support Mantine development](#support-mantine-development)

You can now sponsor Mantine development with [OpenCollective](https://opencollective.com/mantinedev). All funds are used to improve Mantine and create new features and components.

[Sponsor Mantine](https://opencollective.com/mantinedev)

## [Migration guide](#migration-guide)

This changelog covers breaking changes and new features in Mantine 8.0. To migrate your application to Mantine 8.0, follow [7.x → 8.x migration guide](https://mantine.dev/guides/7x-to-8x/).

## [Granular global styles exports](#granular-global-styles-exports)

Global styles are now split between 3 files:

- `baseline.css` – a minimal CSS reset, sets `box-sizing: border-box` and changes font properties
- `default-css-variables.css` – contains all CSS variables generated from the default theme
- `global.css` – global classes used in Mantine components

If you previously imported individual styles from `@mantine/core` package, you need to update imports to use new files:

If you imported `@mantine/core/styles.css`, no changes are required – all new files are already included in `styles.css`.

## [Menu with submenus](#menu-with-submenus)

[Menu](https://mantine.dev/core/menu/) component now supports submenus:

## [Popover hideDetached](#popover-hidedetached)

[Popover](https://mantine.dev/core/popover/) component now supports `hideDetached` prop to configure how the dropdown behaves when the target element is hidden with styles (`display: none`, `visibility: hidden`, etc.), removed from the DOM, or when the target element is scrolled out of the viewport.

By default, `hideDetached` is enabled – the dropdown is hidden with the target element. You can change this behavior with `hideDetached={false}`. To see the difference, try to scroll the root element of the following demo:

## [Date values as strings](#date-values-as-strings)

All `@mantine/dates` components now use date strings in `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss` format instead of `Date` objects. This change was made to resolve issues related to timezones – now the output of all `@mantine/dates` components does not include any timezone-specific information. Follow [7.x → 8.x migration guide](https://mantine.dev/guides/7x-to-8x/) to learn how to update the code to use new string values.

Example of using [DatePicker](https://mantine.dev/dates/date-picker/) component with string values:

| Mo  | Tu  | We  | Th  | Fr  | Sa  | Su  |
| --- | --- | --- | --- | --- | --- | --- |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |

## [DatesProvider timezone](#datesprovider-timezone)

`DatesProvider` component no longer supports `timezone` option – all `@mantine/dates` components now use strings in `YYYY-MM-DD HH:mm:ss` format as values and do not contain timezone information.

If you need to handle timezones in your application, you can use a dedicated dates library ([dayjs](https://day.js.org/), [luxon](https://moment.github.io/luxon/#/), [date-fns](https://date-fns.org/)) to update timezone values.

Example of using Mantine components with [dayjs](https://day.js.org/):

## [TimePicker component](#timepicker-component)

New [TimePicker](https://mantine.dev/dates/time-picker/) component is an alternative to [TimeInput](https://mantine.dev/dates/time-input/) that offers more features. It supports 24-hour and 12-hour formats, dropdown with hours, minutes and seconds, and more.

Enter time (24h format)

::

Enter time (12h format)

::

## [DateTimePicker component changes](#datetimepicker-component-changes)

[DateTimePicker](https://mantine.dev/dates/date-time-picker/) component now uses [TimePicker](https://mantine.dev/dates/time-picker/) under the hood instead of [TimeInput](https://mantine.dev/dates/time-input/). You can now use all [TimePicker](https://mantine.dev/dates/time-picker/) features with [DateTimePicker](https://mantine.dev/dates/date-time-picker/) component.

Prop `timeInputProps` is no longer available, to pass props down to the underlying [TimePicker](https://mantine.dev/dates/time-picker/) you need to use `timePickerProps` prop.

Example of enabling dropdown and setting `12h` format for time picker:

Pick date and time

## [TimeValue component](#timevalue-component)

New [TimeValue](https://mantine.dev/dates/time-value/) component can be used to display a formatted time string with similar formatting options to [TimePicker](https://mantine.dev/dates/time-picker/) component.

24h format: 18:45

12h format: 6:45 PM

## [TimeGrid component](#timegrid-component)

New [TimeGrid](https://mantine.dev/dates/time-grid/) component allows to capture time value from the user with a predefined set of time slots:

Format

12h

24h

With seconds

Size

Radius

## [Heatmap component](#heatmap-component)

New [Heatmap](https://mantine.dev/charts/heatmap/) component allows to display data in a calendar heatmap format:

MonWedFriSunFebMarAprMayJunJulAugSepOctNovDecJan

## [CodeHighlight changes](#codehighlight-changes)

[@mantine/code-highlight](https://mantine.dev/x/code-highlight/) package no longer depends on [highlight.js](https://highlightjs.org/). Instead, it now provides a new API based on adapters that allows using any syntax highlighter of your choice. Out of the, box `@mantine/code-highlight` provides adapters for [shiki](https://shiki.matsu.io/) and [highlight.js](https://highlightjs.org/).

To learn about the migration process and how to use the new adapters API, check the updated [CodeHighlight documentation](https://mantine.dev/x/code-highlight/) and [7.x → 8.x migration guide](https://mantine.dev/guides/7x-to-8x/).

## [CodeHighlight with shiki](#codehighlight-with-shiki)

You can now use [CodeHighlight](https://mantine.dev/x/code-highlight/) component with [shiki](https://shiki.matsu.io/).

[Shiki](https://shiki.matsu.io/) library provides the most advanced syntax highlighting for TypeScript and CSS/Sass code. It uses textmate grammars to highlight code (same as in VSCode). Shiki adapter is recommended if you need to highlight advanced TypeScript (generics, jsx nested in props) or CSS code (custom syntaxes, newest features). Shiki adapter is used for all code highlighting in Mantine documentation.

To use shiki adapter, you need to install `shiki` package:

Then wrap your app with `CodeHighlightAdapterProvider` and provide `createShikiAdapter` as `adapter` prop:

After that, you can use `CodeHighlight` component in your application:

## [Carousel changes](#carousel-changes)

[@mantine/carousel](https://mantine.dev/x/carousel/) package was updated to use the latest version of `embla-carousel-react` package. This update includes breaking changes:

- `speed` and `draggable` props were removed – they are no longer supported by `embla-carousel-react`
- It is now required to install both `embla-carousel` and `embla-carousel-react` packages explicitly
- `useAnimationOffsetEffect` hook was removed – the issue it addressed was fixed in `embla-carousel-react`
- `Embla` type export was removed, you should use `EmblaCarouselType` from `embla-carousel` instead
- Props that were previously passed to embla are now grouped under `emblaOptions` prop

Follow the [7.x → 8.x migration guide](https://mantine.dev/guides/7x-to-8x/) to update your application to use the latest version of `@mantine/carousel`.

## [Switch withThumbIndicator](#switch-withthumbindicator)

[Switch](https://mantine.dev/core/switch/) component styles were updated to include indicator inside the thumb. You can change it by setting `withThumbIndicator` prop:

I agree to sell my privacy

Color

With thumb indicator

Label position

Right

Left

Label

Description

Error

Size

Radius

Disabled

## [Theme types augmentation](#theme-types-augmentation)

You can now augment `spacing`, `radius`, `breakpoints`, `fontSizes`, `lineHeights`, and `shadows` types. To learn more about this feature, follow [this guide](https://mantine.dev/guides/typescript/#theme-object-declarations).

Example of types augmentation for `spacing` and `radius`:

## [Other changes](#other-changes)

- [Kbd](https://mantine.dev/core/kbd/) component now supports `size` prop
- [DateInput](https://mantine.dev/dates/date-input/) component no longer supports `preserveTime` prop, use different component to capture time values
- [ScrollArea](https://mantine.dev/core/scroll-area/) component no longer has forced `display: table` styles on the wrapper element of the content. It also now supports `content` Styles API selector to apply styles to the content element.
- [ImageIcon](https://mantine.dev/core/image/) component no longer includes `flex: 0` styles by default
- [SegmentedControl](https://mantine.dev/core/segmented-control/) default height values were changed to match sizes of [Input](https://mantine.dev/core/input/) components
- Type of `wrapperProps` prop in all components that support it (`Checkbox`, `Radio`, `Chip`, most inputs) was changed to more strict type
- [Portal](https://mantine.dev/core/portal/) component now has `reuseTargetNode` prop enabled by default
- [use-form](https://mantine.dev/form/use-form/) `setFieldValue` handler types are now stricter
- [Menu.Item](https://mantine.dev/core/menu/) no longer has `data-hovered` attribute, use `:hover` and `:focus` selectors instead to apply styles
- [use-os](https://mantine.dev/hooks/use-os/) now supports Chrome OS detection, its return type now includes `chromeos` value in the union
- The default eye dropper icon of [ColorInput](https://mantine.dev/core/color-input/) component was updated
- The default spacing of [Notification](https://mantine.dev/core/notification/) component was increased
- [CodeIcon](https://mantine.dev/core/code/) component color styles were updated
