## [Auto convert px to rem in.css files](#auto-convert-px-to-rem-in-css-files)

Start from version `1.14.4` [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) supports `autoRem` option that can be used to automatically convert all `px` values to `rem` units in `.css` files.

This option works similar to `rem` function. The following code:

Will be transformed to:

Note that `autoRem` converts only CSS properties, values in `@media` queries are not converted automatically – you still need to use `em` function to convert them.

`autoRem` option does not convert values in the following cases:

- Values in `calc()`, `var()`, `clamp()` and `url()` functions
- Values in `content` property
- Values that contain `rgb()`, `rgba()`, `hsl()`, `hsla()` colors

If you want to convert above values to rem units, use `rem` function manually.

## [Uncontrolled form mode](#uncontrolled-form-mode)

[useForm](https://mantine.dev/form/use-form/) hook now supports [uncontrolled mode](https://mantine.dev/form/uncontrolled/). Uncontrolled mode provides a significant performance improvement by reducing the number of re-renders and the amount of state updates almost to 0. Uncontrolled mode is now the recommended way to use the `useForm` hook for almost all use cases.

Example of uncontrolled form (`form.values` are not updated):

Name

Email

Form values:

{
"name": "",
"email": ""
}

Submitted values:

–

## [form.getValues](#formgetvalues)

With uncontrolled mode, you can not access `form.values` as a state variable, instead, you can use `form.getValues()` method to get current form values at any time:

`form.getValues()` always returns the latest form values, it is safe to use it after state updates:

## [form.watch](#formwatch)

`form.watch` is an effect function that allows subscribing to changes of a specific form field. It accepts field path and a callback function that is called with new value, previous value, touched and dirty field states:

Name

Email

## [Customize Popover middlewares](#customize-popover-middlewares)

You can now customize `middlewares` options in [Popover](https://mantine.dev/core/popover/) component and in other components ([Menu](https://mantine.dev/core/menu/), [Select](https://mantine.dev/core/select/), [Combobox](https://mantine.dev/core/combobox/), etc.) based on Popover.

To customize [Floating UI](https://floating-ui.com/) middlewares options, pass them as an object to the `middlewares` prop. For example, to change [shift](https://floating-ui.com/docs/shift) middleware padding to `20px` use the following configuration:

## [use-fetch hook](#use-fetch-hook)

New [use-fetch](https://mantine.dev/hooks/use-fetch/) hook:

\[
{
"userId": 1,
"id": 1,
"title": "delectus aut autem",
"completed": false
},
{
"userId": 1,
"id": 2,
"title": "quis ut nam facilis et officia qui",
"completed": false
},
{
"userId": 1,
"id": 3,
"title": "fugiat veniam minus",
"completed": false
}
\]

## [use-map hook](#use-map-hook)

New [use-map](https://mantine.dev/hooks/use-map/) hook:

| Page                   | Views last month |     |
| ---------------------- | ---------------- | --- |
| /hooks/use-media-query | 4124             |     |
| /hooks/use-clipboard   | 8341             |     |
| /hooks/use-fetch       | 9001             |     |

## [use-set hook](#use-set-hook)

New [use-set](https://mantine.dev/hooks/use-set/) hook:

Add new scope

Duplicate scopes are not allowed

`@mantine``@mantine-tests``@mantinex`

## [use-debounced-callback hook](#use-debounced-callback-hook)

New [use-debounced-callback](https://mantine.dev/hooks/use-debounced-callback/) hook:

## [use-throttled-state hook](#use-throttled-state-hook)

New [use-throttled-state](https://mantine.dev/hooks/use-throttled-state/) hook:

Throttled value: –

## [use-throttled-value hook](#use-throttled-value-hook)

New [use-throttled-value](https://mantine.dev/hooks/use-throttled-value/) hook:

Throttled value: –

## [use-throttled-callback hook](#use-throttled-callback-hook)

New [use-throttled-callback](https://mantine.dev/hooks/use-throttled-callback/) hook:

Throttled value: –

## [use-orientation hook](#use-orientation-hook)

New [use-orientation](https://mantine.dev/hooks/use-orientation/) hook:

Angle: `0`

Type: `landscape-primary`

## [use-is-first-render hook](#use-is-first-render-hook)

New [use-is-first-render](https://mantine.dev/hooks/use-is-first-render/) hook:

Is first render: Yes

## [Documentation updates](#documentation-updates)

- New [uncontrolled form](https://mantine.dev/form/uncontrolled/) guide
- [onValuesChange](https://mantine.dev/form/values/#onvalueschange) documentation has been added
- A new demo has been added to [tiptap](https://mantine.dev/x/tiptap/#typography-styles) that shows how to customize typography styles
- A new guide has been added to customize [Popover](https://mantine.dev/core/popover/#customize-middleware-options) middlewares

## [Other changes](#other-changes)

- [NumberInput](https://mantine.dev/core/number-input/) now supports `withKeyboardEvents={false}` to disable up/down arrow keys handling
- [Popover](https://mantine.dev/core/popover/) [shift](https://floating-ui.com/docs/shift) middleware now has default padding of 5px to offset dropdown near the edge of the viewport
