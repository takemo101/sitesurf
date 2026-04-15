## [@mantine/charts](#mantinecharts)

New [@mantine/charts](https://mantine.dev/charts/getting-started/) package provides a set of components to build charts and graphs. All components are based on [recharts](https://recharts.org/en-US/). Currently, the package provides [AreaChart](https://mantine.dev/charts/area-chart/), [BarChart](https://mantine.dev/charts/bar-chart/), [LineChart](https://mantine.dev/charts/line-chart/) and [Sparkline](https://mantine.dev/charts/sparkline/) components. More components will be added in the next minor releases.

## [AreaChart component](#areachart-component)

New [AreaChart](https://mantine.dev/charts/area-chart/) component:

## [LineChart component](#linechart-component)

New [LineChart](https://mantine.dev/charts/line-chart/) component:

Apples

Oranges

Tomatoes

Mar 22Mar 23Mar 24Mar 25Mar 260900180027003600

## [BarChart component](#barchart-component)

New [BarChart](https://mantine.dev/charts/bar-chart/) component:

## [Sparkline component](#sparkline-component)

New [Sparkline](https://mantine.dev/charts/sparkline/) component:

Curve type

Color

Fill opacity

With gradient

Stroke width

## [OKLCH colors support](#oklch-colors-support)

You can now use [OKLCH](https://oklch.com/) colors in `theme.colors`. OKLCH color model has [88.18% browser support](https://caniuse.com/mdn-css_types_color_oklch), it is supported in all modern browsers. OKLCH model provides 30% more colors than HSL model and has [several other advantages](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl).

Example of adding OKLCH color to the theme:

## [autoContrast](#autocontrast)

New `theme.autoContrast` property controls whether text color should be changed based on the given `color` prop in the following components:

- [ActionIcon](https://mantine.dev/core/action-icon/) with `variant="filled"` only
- [Alert](https://mantine.dev/core/alert/) with `variant="filled"` only
- [Avatar](https://mantine.dev/core/avatar/) with `variant="filled"` only
- [Badge](https://mantine.dev/core/badge/) with `variant="filled"` only
- [Button](https://mantine.dev/core/button/) with `variant="filled"` only
- [Chip](https://mantine.dev/core/chip/) with `variant="filled"` only
- [NavLink](https://mantine.dev/core/nav-link/) with `variant="filled"` only
- [ThemeIcon](https://mantine.dev/core/theme-icon/) with `variant="filled"` only
- [Checkbox](https://mantine.dev/core/checkbox/) with `variant="filled"` only
- [Radio](https://mantine.dev/core/radio/) with `variant="filled"` only
- [Tabs](https://mantine.dev/core/tabs/) with `variant="pills"` only
- [SegmentedControl](https://mantine.dev/core/segmented-control/)
- [Stepper](https://mantine.dev/core/stepper/)
- [Pagination](https://mantine.dev/core/pagination/)
- [Progress](https://mantine.dev/core/progress/)
- [Indicator](https://mantine.dev/core/indicator/)
- [Timeline](https://mantine.dev/core/timeline/)
- [Spotlight](https://mantine.dev/x/spotlight/)
- All [@mantine/dates](https://mantine.dev/dates/getting-started/) components that are based on [Calendar](https://mantine.dev/dates/calendar/) component

`autoContrast` can be set globally on the theme level or individually for each component via `autoContrast` prop, except for [Spotlight](https://mantine.dev/x/spotlight/) and [@mantine/dates](https://mantine.dev/dates/getting-started/) components, which only support global theme setting.

`autoContrast: true`

`autoContrast: false`

`autoContrast` checks whether the given color luminosity is above or below the `luminanceThreshold` value and changes text color to either `theme.white` or `theme.black` accordingly:

Color

Luminance threshold

## [Color functions improvements](#color-functions-improvements)

`alpha`, `lighten` and `darken` functions now support CSS variables (with [color-mix](https://caniuse.com/mdn-css_types_color_color-mix)) and OKLCH colors. All functions are available both in `@mantine/core` (`.ts`/`.js` files) and [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) (`.css` files, requires version 1.12.0 or higher).

In `.css` files:

Will be transformed to:

In `.ts`/`.js` files:

Note that `alpha` function is a replacement for `rgba`. It was renamed to have a more clear meaning, as it can now be used with CSS variables and OKLCH colors. `rgba` function is still available as an alias for `alpha` function.

## [enhanceGetInputProps](#enhancegetinputprops)

`@mantine/form` now supports [enhanceGetInputProps](https://mantine.dev/form/get-input-props/#enhancegetinputprops). `enhanceGetInputProps` is a function that can be used to add additional props to the object returned by `form.getInputProps`. You can define it in `useForm` hook options. Its argument is an object with the following properties:

- `inputProps` – object returned by `form.getInputProps` by default
- `field` – field path, first argument of `form.getInputProps`, for example `name`, `user.email`, `users.0.name`
- `options` – second argument of `form.getInputProps`, for example `{ type: 'checkbox' }`, can be used to pass additional options to `enhanceGetInputProps` function
- `form` – form instance

Example of using `enhanceGetInputProps` to disable input based on field path:

Name

Age

Example of using `enhanceGetInputProps` to add additional props to the input based on option passed to `form.getInputProps`:

Your name

Your personal information is stored securely. (Just kidding!)

Age

## [form.initialize](#forminitialize)

`@mantine/form` now supports `form.initialize` handler.

When called `form.initialize` handler sets `initialValues` and `values` to the same value and marks form as initialized. It can be used only once, next `form.initialize` calls are ignored.

`form.initialize` is useful when you want to sync form values with backend API response:

Name

Age

Example with [TanStack Query](https://tanstack.com/query/latest) (react-query):

Note that `form.initialize` will erase all values that were set before it was called. It is usually a good idea to set `readOnly` or `disabled` on all form fields before `form.initialize` is called to prevent data loss. You can implement this with [enhanceGetInputProps](https://mantine.dev/form/get-input-props/#enhancegetinputprops):

Your name

Age

## [valibot form resolver](#valibot-form-resolver)

`@mantine/form` now supports [validbot schema resolver](https://www.npmjs.com/package/mantine-form-valibot-resolver):

Basic fields validation:

Nested fields validation

List fields validation:

## [ScrollArea scrollbars prop](#scrollarea-scrollbars-prop)

[ScrollArea](https://mantine.dev/core/scroll-area/) now supports `scrollbars` prop, which allows controlling directions at which scrollbars should be rendered. Supported values are `x`, `y` and `xy`. If `scrollbars="y"` is set, only the vertical scrollbar will be rendered, and it will not be possible to scroll horizontally:

## [Title lineClamp prop](#title-lineclamp-prop)

[Title](https://mantine.dev/core/title/) component now supports `lineClamp` prop, which allows truncating text after a specified number of lines:

## Lorem ipsum dolor sit amet consectetur adipisicing elit. Iure doloremque quas dolorum. Quo amet earum alias consequuntur quam accusamus a quae beatae, odio, quod provident consectetur non repudiandae enim adipisci?

Line clamp

## [Primary color CSS variables](#primary-color-css-variables)

CSS variables for primary color are now available, you can use the following variables in your styles:

## [Help center](#help-center)

[Help center](https://help.mantine.dev/) is a new website with guides, tutorials and frequently asked questions. Currently, it has 14 questions, more FAQs will be added in the next releases.

- [Is there DataGrid component that I can use with Mantine?](https://help.mantine.dev/q/data-grid-i-need)
- [MantineProvider was not found in component tree. What should I do?](https://help.mantine.dev/q/mantine-provider-missing)
- [Can I use Mantine components as server components?](https://help.mantine.dev/q/server-components)
- [Can I use Mantine with Create React App (CRA)?](https://help.mantine.dev/q/can-i-use-mantine-with-cra)
- [How can I lint CSS files?](https://help.mantine.dev/q/how-to-setup-stylelint)
- [How to update Mantine dependencies?](https://help.mantine.dev/q/how-to-update-dependencies)
- [How can I add hover styles to an element?](https://help.mantine.dev/q/how-to-add-hover-styles)
- [How can I get current color scheme value in JavaScript?](https://help.mantine.dev/q/how-to-get-color-scheme-value-in-js)
- [Can I use private CSS variables to style components?](https://help.mantine.dev/q/private-css-variables)
- [How can I disable all inputs/inputs group inside form?](https://help.mantine.dev/q/disable-all-inputs-in-form)
- [How to use Dropzone with @mantine/form?](https://help.mantine.dev/q/how-to-use-dropzone-with-form)
- [How to call a function when Modal/Drawer closes and animation completes?](https://help.mantine.dev/q/how-to-call-function-when-modal-closes)
- [How to prevent Modal from closing?](https://help.mantine.dev/q/how-to-prevent-modal-from-closing)
- [What is the difference between searchable Select and Autocomplete?](https://help.mantine.dev/q/select-autocomplete-difference)

## [Documentation updates](#documentation-updates)

- [form.getInputProps](https://mantine.dev/form/get-input-props/) guide now has a separate page. It describes `form.getInputProps`, `enhanceGetInputProps` and how to integrate `form.getInputProps` with custom inputs.
- [assignRef](https://mantine.dev/hooks/use-merged-ref/#assignref-function) function documentation has been added.
- [clampUseMovePosition](https://mantine.dev/hooks/use-move/#clampusemoveposition) function documentation has been added.
- Additional documentation about hook arguments and types has been added to [use-hotkeys](https://mantine.dev/hooks/use-hotkeys/).
- [UseListStateHandlers type](https://mantine.dev/hooks/use-list-state/#useliststatehandlers-type) documentation has been added.
- [Functions reference](https://mantine.dev/guides/functions-reference/) page has been added. Currently, it contains all functions that are exported from `@mantine/hooks` package. It is planned to document functions from other packages in next releases.
- Examples on how to change the close icon have been added to [Drawer](https://mantine.dev/core/drawer/#change-close-icon) and [Modal](https://mantine.dev/core/modal/#change-close-icon) components.
- `variantColorsResolver` demos have been added to [ActionIcon](https://mantine.dev/core/action-icon/), [ThemeIcon](https://mantine.dev/core/theme-icon/) and [Badge](https://mantine.dev/core/badge/) components.

## [Other changes](#other-changes)

- [RichTextEditor](https://mantine.dev/x/tiptap/) no longer depends on `@tabler/icons` package. It is no longer required to install `@tabler/icons` package to use `RichTextEditor` component. Icons used in the editor are now a part of the `@mantine/tiptap` package. This change improves bundling performance in several cases (mostly when using `RichTextEditor` in Next.js apps).
- [Badge](https://mantine.dev/core/badge/) component now supports `circle` prop which makes the badge round.
- You can now reference theme values in `ff` [style prop](https://mantine.dev/styles/style-props/) with `mono`, `text` and `heading` values: `<Box ff="mono" />`.
- [RichTextEditor](https://mantine.dev/x/tiptap/) now has `RichTextEditor.Undo` and `RichTextEditor.Redo` controls.
- A new `luminance` [color function](https://mantine.dev/styles/color-functions/) was added. It returns color luminance as a number between 0 and 1.
- All components now support new `flex` [style prop](https://mantine.dev/styles/style-props/) which allows setting `flex` CSS property on the root element.
- [Collapse](https://mantine.dev/core/collapse/) markup was reduced to single element, it can now be used in contexts that were previously not supported, for example, table rows.
- `stepHoldDelay` and `stepHoldInterval` props have been added to [NumberInput](https://mantine.dev/core/number-input/).
- [mantine-form-zod-resolver](https://github.com/mantinedev/mantine-form-zod-resolver) now supports `errorPriority` configuration which allows controlling the order of errors specified in the schema. This feature requires updating `mantine-form-zod-resolver` to version 1.1.0 or higher.
- [CloseButton](https://mantine.dev/core/close-button/) now supports `icon` prop, which allows overriding default icon. It is useful when it is not possible to replace `CloseButton`, for example, in [Drawer](https://mantine.dev/core/drawer/) component.
- [Select](https://mantine.dev/core/select/#onchange-handler) component now calls `onChange` with an additional argument – option object. It contains `label`, `value` and optional `disabled` properties.
- It is now possible to define CSS variables in `styles` prop of all components.
- New [use-in-viewport](https://mantine.dev/hooks/use-in-viewport/) hook
- All Vite templates have been updated to Vite 5.0 and Vitest 1.0
