## [Support Mantine development](#support-mantine-development)

You can now sponsor Mantine development with [OpenCollective](https://opencollective.com/mantinedev). All funds are used to improve Mantine and create new features and components.

[Sponsor Mantine](https://opencollective.com/mantinedev)

## [MiniCalendar component](#minicalendar-component)

New [MiniCalendar](https://mantine.dev/dates/mini-calendar/) component:

## [Progress vertical orientation](#progress-vertical-orientation)

[Progress](https://mantine.dev/core/progress/) now supports vertical orientation:

Documents

Apps

Other

## [Heatmap splitMonths](#heatmap-splitmonths)

[Heatmap](https://mantine.dev/charts/heatmap/) now supports `splitMonths` prop to visually separate months with a spacer column and render only days that belong to each month in its columns.

FebMarAprMayJunJulAugSepOctNovDecJanFeb

## [Improved clearable prop handling](#improved-clearable-prop-handling)

[Select](https://mantine.dev/core/select/), [MultiSelect](https://mantine.dev/core/multi-select/), and other components with `clearable` prop now allow displaying the clear button next to the right section:

Your favorite library

## [Tiptap 3 support](#tiptap-3-support)

[@mantine/tiptap](https://mantine.dev/x/tiptap/) now supports [Tiptap 3](https://tiptap.dev/docs). It is recommended to update all `@tiptap/*` packages to version 3.2.0 or later.

Your application might require some modifications related to Tiptap 3. If you want to update your application to TipTap 3, follow [migration guide](https://mantine.dev/guides/tiptap-3-migration/).

## [LLMs.txt](#llmstxt)

You can now use LLMs.txt file with Cursor and other IDEs. The file is automatically updated with each release and includes every demo and documentation page from mantine.dev. It is about 1.8mb. You can find the latest version of LLMs.txt [here](https://mantine.dev/llms.txt) and further documentation [here](https://mantine.dev/guides/llms/).

## [Other changes](#other-changes)

- [MultiSelect](https://mantine.dev/core/multi-select/) now supports `clearSearchOnChange` prop to clear search input when an item is selected.
- [Reordering list items example](https://mantine.dev/form/recipes/#list-items-reordering) now uses [dnd-kit](https://dndkit.com/) instead of `@hello-pangea/dnd`
- [TimePicker](https://mantine.dev/dates/time-picker/) now supports `reverseTimeControlsList` prop to reverse the order of time controls in the dropdown. Use this option if you want the order of controls to match keyboard controls (up and down arrow) direction.
- [DirectionProvider](https://mantine.dev/styles/rtl/) now automatically subscribes to the `dir` attribute mutations of the root element (usually `<html />`) and updates internal state automatically.
- [Select](https://mantine.dev/core/select/) and [MultiSelect](https://mantine.dev/core/multi-select/) now retain references to selected options that are no longer present in `data` prop.
- Active color swatch now has check icon in [ColorPicker](https://mantine.dev/core/color-picker/) and [ColorInput](https://mantine.dev/core/color-input/) components.
