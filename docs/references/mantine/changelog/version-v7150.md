## [Support Mantine development](#support-mantine-development)

You can now sponsor Mantine development with [OpenCollective](https://opencollective.com/mantinedev). All funds are used to improve Mantine and create new features and components.

[Sponsor Mantine](https://opencollective.com/mantinedev)

## [use-radial-move hook](#use-radial-move-hook)

New [use-radial-move](https://mantine.dev/hooks/use-radial-move/) hook can be used to create custom radial sliders:

115°

## [BarChart color based on value](#barchart-color-based-on-value)

[BarChart](https://mantine.dev/charts/bar-chart/) component now supports `getBarColor` prop to assign color based on value. `getBarColor` function is called with two arguments: value and series object. It should return a color string (theme color reference or any valid CSS color value).

## [Button.GroupSection and ActionIcon.GroupSection](#buttongroupsection-and-actionicongroupsection)

`ActionIcon.GroupSection` and `Button.GroupSection` are new components that can be used in `ActionIcon.Group`/`Button.Group` to create sections that are not `ActionIcon`/`Button` components:

135

## [Table vertical variant](#table-vertical-variant)

[Table](https://mantine.dev/core/table/) component now support `variant="vertical"`:

<table data-variant="vertical" data-with-table-border="true"><tbody><tr data-with-row-border="true"><th>Epic name</th><td>7.x migration</td></tr><tr data-with-row-border="true"><th>Status</th><td>Open</td></tr><tr data-with-row-border="true"><th>Total issues</th><td>135</td></tr><tr data-with-row-border="true"><th>Total story points</th><td>874</td></tr><tr data-with-row-border="true"><th>Last updated at</th><td>September 26, 2024 17:41:26</td></tr></tbody></table>

## [Table tabular numbers](#table-tabular-numbers)

[Table](https://mantine.dev/core/table/) component now supports `tabularNums` prop to render numbers in tabular style. It sets `font-variant-numeric: tabular-nums` which makes numbers to have equal width. This is useful when you have columns with numbers and you want them to be aligned:

| Product    | Units sold    |
| ---------- | ------------- |
| Apples     | 2,214,411,234 |
| Oranges    | 9,983,812,411 |
| Bananas    | 1,234,567,890 |
| Pineapples | 9,948,810,000 |
| Pears      | 9,933,771,111 |

Tabular nums

## [Update function in modals manager](#update-function-in-modals-manager)

[Modals manager](https://mantine.dev/x/modals/) now supports `modals.updateModal` and `modals.updateContextModal` function to update modal after it was opened:

## [useForm submitting state](#useform-submitting-state)

[use-form](https://mantine.dev/form/use-form/) hook now supports `form.submitting` field and `form.setSubmitting` function to track form submission state.

`form.submitting` field will be set to `true` if function passed to `form.onSubmit` returns a promise. After the promise is resolved or rejected, `form.submitting` will be set to `false`:

Name

You can also manually set `form.submitting` to `true` or `false`:

## [useForm onSubmitPreventDefault option](#useform-onsubmitpreventdefault-option)

[use-form](https://mantine.dev/form/use-form/) hook now supports `onSubmitPreventDefault` option. This option is useful if you want to integrate `useForm` hook with [server actions](https://github.com/mantinedev/mantine/issues/7142). By default, `event.preventDefault()` is called on the form `onSubmit` handler. If you want to change this behavior, you can pass `onSubmitPreventDefault` option to `useForm` hook. It can have the following values:

- `always` (default) - always call `event.preventDefault()`
- `never` - never call `event.preventDefault()`
- `validation-failed` - call `event.preventDefault()` only if validation failed

## [Subtle RichTextEditor variant](#subtle-richtexteditor-variant)

[RichTextEditor](https://mantine.dev/x/tiptap/) component now supports `subtle` variant:

Subtle rich text editor variant

## [onExitTransitionEnd and onEnterTransitionEnd](#onexittransitionend-and-onentertransitionend)

[Modal](https://mantine.dev/core/modal/) and [Drawer](https://mantine.dev/core/drawer/) components now support `onExitTransitionEnd` and `onEnterTransitionEnd` props, which can be used to run code after exit/enter transition is finished. For example, this is useful when you want to clear data after modal is closed:

## [Week numbers in DatePicker](#week-numbers-in-datepicker)

[DatePicker](https://mantine.dev/dates/date-picker/) and other components based on Calendar component now support `withWeekNumbers` prop to display week numbers:

| #   | Mo  | Tu  | We  | Th  | Fr  | Sa  | Su  |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 14  |     |     |     |     |     |     |     |
| 15  |     |     |     |     |     |     |     |
| 16  |     |     |     |     |     |     |     |
| 17  |     |     |     |     |     |     |     |
| 18  |     |     |     |     |     |     |     |

## [New demo: BarChart with overlay](#new-demo-barchart-with-overlay)

## [Variants types augmentation](#variants-types-augmentation)

[Custom variants](https://mantine.dev/styles/variants-sizes/#custom-variants-types) types augmentation guide was added to the documentation.

Example of adding custom variant type to [Button](https://mantine.dev/core/button/) component:

## [Help Center updates](#help-center-updates)

- [How to use Mantine template on GitHub?](https://help.mantine.dev/q/templates-usage) and [How can I submit a template to Mantine documentation?](https://help.mantine.dev/q/submit-template) pages were moved from the documentation to Help Center
- [How that thing is done on mantine.dev website?](https://help.mantine.dev/q/how-that-thing-is-done) question
- [Why is it required to have 10 shades per color?](https://help.mantine.dev/q/ten-shades-per-color) question
- [Why I see color scheme flickering on page load?](https://help.mantine.dev/q/color-scheme-flickering) question
- [How can I test Modal/Drawer/Popover components?](https://help.mantine.dev/q/portals-testing) question
