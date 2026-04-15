## [smaller-than and larger-than mixins](#smaller-than-and-larger-than-mixins)

`smaller-than` and `larger-than` mixins can be used to create styles that will be applied only when the screen is smaller or larger than specified breakpoint. Note that to use these mixins, you need to update [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) to version `1.11.0` or higher.

Will be transformed to:

You can also use `smaller-than` and `larger-than` mixins with [mantine breakpoints](https://mantine.dev/styles/responsive/#breakpoints-variables-in-css-modules):

## [Form schema resolvers packages](#form-schema-resolvers-packages)

`@mantine/form` schema validation resolver packages are now available as [separate packages](https://mantine.dev/form/schema-validation/). Moving resolvers to separate packages allows making them type-safe and fully tested. Old resolvers are still exported from `@mantine/form` package – you will be able to use them without any changes until 8.0.0 release.

The new packages are drop-in replacements for old resolvers, they have the same API and can be used in the same way.

Example of zod resolver:

## [rem/em functions improvements](#remem-functions-improvements)

[rem and em](https://mantine.dev/styles/rem/) function now support space-separated values. This feature is available both in `rem` function exported from `@mantine/core` package and [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/). Note that you need to update [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) to `1.11.0` to use this feature.

All components props that are converted to `rem` units now support space-separated values as well. For example, space-separated values can be used in `radius` prop of [Modal](https://mantine.dev/core/modal/) component:

## [component and renderRoot props for non-polymorphic components](#component-and-renderroot-props-for-non-polymorphic-components)

All Mantine components now support `component` and `renderRoot` props event if they are not [polymorphic](https://mantine.dev/guides/polymorphic/). The difference between polymorphic and non-polymorphic components is that polymorphic components include the full set of props of the component passed to the `component` prop, while non-polymorphic components only include props that are specific to the original component. It is done this way to improve TypeScript performance.

## [Outline Checkbox and Radio variant](#outline-checkbox-and-radio-variant)

[Checkbox](https://mantine.dev/core/checkbox/) and [Radio](https://mantine.dev/core/radio/) components now support `outline` variant:

Outline Checkbox

Outline indeterminate Checkbox

Outline Radio

## [HueSlider and AlphaSlider components](#hueslider-and-alphaslider-components)

[HueSlider and AlphaSlider](https://mantine.dev/core/color-picker/) components were added back:

Hue value: 250

Alpha value: 0.55

## [Button loading state animation](#button-loading-state-animation)

[Button](https://mantine.dev/core/button/) component now has loading state animation:

Loading state

## [Drawer offset](#drawer-offset)

[Drawer](https://mantine.dev/core/drawer/) now supports `offset` prop. It changes drawer offset from the edge of the viewport:

## [z-index CSS variables](#z-index-css-variables)

You can now use Mantine z-index CSS variables:

- `--mantine-z-index-app` – value `100`
- `--mantine-z-index-modal` – value `200`
- `--mantine-z-index-popover` – value `300`
- `--mantine-z-index-overlay` – value `400`
- `--mantine-z-index-max` – value `9999`

Example of using `--mantine-z-index-modal` variable:

## [Improved dark color scheme colors](#improved-dark-color-scheme-colors)

`theme.colors.dark` colors were slightly changed to improve contrast and make it easier to read text. You can preview new colors on [this page](https://mantine.dev/theming/colors/#default-colors). New colors values are:

If you prefer old colors, change theme settings on `MantineProvider`:

## [Documentation updates](#documentation-updates)

- Schema-based validation with `@mantine/form` now has a [dedicated page](https://mantine.dev/form/schema-validation/). It includes more examples for basic, nested and list fields validation for each resolver.
- [Autocomplete](https://mantine.dev/core/autocomplete/), [Select](https://mantine.dev/core/select/), [MultiSelect](https://mantine.dev/core/multi-select/) and [TagsInput](https://mantine.dev/core/tags-input/) now include new demos that show how to customize dropdown behavior and styles.
- Example of using Mantine with disabled JavaScript was added to the [color schemes guide](https://mantine.dev/theming/color-schemes/#with-disabled-javascript).
- [Pagination](https://mantine.dev/core/pagination/) now includes an additional example with chunked content handling.
- A new section about dayjs localization with Next.js app router and server components has been added to the [dates getting started page](https://mantine.dev/dates/getting-started/#localization-and-server-components)
- [Modals manager](https://mantine.dev/x/modals/#modal-props) now includes a guide on how to pass props down to the underlying [Modal](https://mantine.dev/core/modal/) component.
- [Slider](https://mantine.dev/core/slider/) now has sections about decimal values and `minRange` prop.
- You can now view all 200+ releases with release dates on the [all releases page](https://mantine.dev/changelog/all-releases/).

## [Other changes](#other-changes)

- [use-hash](https://mantine.dev/hooks/use-hash/) hook now supports `getInitialValueInEffect: false` option to get initial value during state initialization.
- New `useMantineColorScheme({ keepTransitions: true })` option allows keeping transitions when color scheme changes. Note that it is `false` by default.
- All templates were migrated to [yarn v4](https://yarnpkg.com/blog/release/4.0) – this change significantly improves installation speed.
- [Typography](https://mantine.dev/core/typography/) now has styles for `<kbd />` element.
- [MultiSelect](https://mantine.dev/core/multi-select/) and [TagsInput](https://mantine.dev/core/tags-input/) components now support `hiddenValuesDivider` prop. It allows customizing divider character between values in `value` prop of the hidden input.
- [Grid](https://mantine.dev/core/grid/) component now supports `overflow` prop, which allows controlling `overflow` CSS property on the root element. It is `hidden` by default.
- [Modal](https://mantine.dev/core/modal/) and [Drawer](https://mantine.dev/core/drawer/) components now support `removeScrollProps` prop. It allows configuring [react-remove-scroll](https://github.com/theKashey/react-remove-scroll).
- [AppShell](https://mantine.dev/core/app-shell/) now supports `offsetScrollbars` prop. It determines whether scrollbars should be offset, it is `true` by default. The logic of scrollbars offset is controlled by [react-remove-scroll](https://github.com/theKashey/react-remove-scroll).
- [Menu](https://mantine.dev/core/menu/) now supports `trigger="click-hover"` prop, to open menu both on click and on hover.
- It is now possible to set `keepMounted` prop on [Tabs.Panel](https://mantine.dev/core/tabs/) components individually, not only on `Tabs` component.
- [mantine-flagpack](https://mantinedev.github.io/mantine-flagpack/) has been migrated to support `7.x` versions of `@mantine/core`. To use it, update `mantine-flagpack` to `4.0.0`.
- [vite-template](https://github.com/mantinedev/vite-template) was migrated from Jest to [Vitest](https://vitest.dev/).
- The main [Mantine repository](https://github.com/mantinedev/mantine) was migrated to [yarn v4](https://yarnpkg.com/blog/release/4.0). The process of getting started locally [was changed](https://mantine.dev/contribute/#get-started-with-mantine-locally)
- `@mantine/ds` package has been deprecated. You can use `@mantinex/mantine-logo` package to use `MantineLogo` component in your project.
