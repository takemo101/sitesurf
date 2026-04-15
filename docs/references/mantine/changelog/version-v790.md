## [@mantine/emotion package](#mantineemotion-package)

New [@mantine/emotion](https://mantine.dev/styles/emotion/) package is now available to simplify migration from [6.x to 7.x](https://mantine.dev/guides/6x-to-7x/). It includes `createStyles` function and additional functionality for `sx` and `styles` props for all components similar to what was available in `@mantine/core` package in v6.

If you still haven't migrated to 7.x because of the change in styling approach, you can now have a smoother transition by using `@mantine/emotion` package. To learn more about the package, visit the [documentation page](https://mantine.dev/styles/emotion/) and updated [6.x to 7.x migration guide](https://mantine.dev/guides/6x-to-7x/).

createStyles demo

## [React 18.3 support](#react-183-support)

All `@mantine/*` components and hooks have been updated to support React 18.3. It is recommended to update your application as well to prepare for the upcoming [React 19 release](https://react.dev/blog/2024/04/25/react-19).

## [use-field hook](#use-field-hook)

New [use-field](https://mantine.dev/form/use-field/) hook is now available in `@mantine/form` package. It can be used as a simpler alternative to [use-form](https://mantine.dev/form/use-form/) hook to manage state of a single input without the need to create a form. The hook supports most of `use-form` hook features: validation with function, touched and dirty state, error message, validation on change/blur and more.

Email

`use-field` hook also supports async validation:

Enter 'mantine'

## [Custom PostCSS mixins](#custom-postcss-mixins)

You can now define custom mixins that are not included in [mantine-postcss-preset](https://mantine.dev/styles/postcss-preset/) by specifying them in the `mixins` option. To learn about mixins syntax, follow [postcss-mixins documentation](https://github.com/postcss/postcss-mixins#readme). Note that this feature is available in `postcss-preset-mantine` starting from version 1.15.0.

Example of adding `clearfix` and `circle` mixins:

Then you can use these mixins in your styles:

## [use-matches hook](#use-matches-hook)

New `use-matches` hook exported from `@mantine/core` is an alternative to [use-media-query](https://mantine.dev/hooks/use-media-query/) if you need to match multiple media queries and values. It accepts an object with media queries as keys and values at given breakpoint as values.

Note that `use-matches` hook uses the same logic as [use-media-query](https://mantine.dev/hooks/use-media-query/) under the hood, it is not recommended to be used as a primary source of responsive styles, especially if you have ssr in your application.

In the following example:

- Starting from `theme.breakpoints.lg`, color will be `red.9`
- Between `theme.breakpoints.sm` and `theme.breakpoints.lg`, color will be `orange.9`
- Below `theme.breakpoints.sm`, color will be `blue.9`

Box with color that changes based on screen size

## [BarChart value label](#barchart-value-label)

[BarChart](https://mantine.dev/charts/bar-chart/) now supports `withBarValueLabel` prop that allows displaying value label on top of each bar:

JanuaryFebruaryMarchAprilMayJune05001,0001,5002,0001,2001,9004001,0008007509001,2001,0002001,4006002004002008001,2001,000

## [Documentation updates](#documentation-updates)

- New [usage with emotion](https://mantine.dev/styles/emotion/) guide
- [6.x -> 7.x](https://mantine.dev/guides/6x-to-7x/) guide has been updated to include migration to [@mantine/emotion](https://mantine.dev/styles/emotion/) package
- [use-field](https://mantine.dev/form/use-field/) hook documentation
- [Uncontrolled form mode](https://mantine.dev/form/uncontrolled/) examples now include usage of `form.key()` function
- [Custom PostCSS mixins](https://mantine.dev/styles/postcss-preset/#custom-mixins) documentation
- [use-matches](https://mantine.dev/styles/responsive/#use-matches-hook) hook documentation has been added to the responsive guide

## [Other changes](#other-changes)

- Advanced templates now include GitHub workflows to run tests on CI
- [AspectRatio](https://mantine.dev/core/aspect-ratio/) component has been migrated to [aspect-ratio](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio) CSS property
