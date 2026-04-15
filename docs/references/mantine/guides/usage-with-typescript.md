# Usage with TypeScript

All `@mantine/*` packages are fully compatible with TypeScript. All examples in the documentation are written in TypeScript – you can copy and paste them to your project without any changes.

This guide will help you get familiar with the types that the `@mantine/core` package exports.

## [Components props types](#components-props-types)

Each `@mantine/` package that exports components also exports props types for these components. You can import component props types by adding `Props` to the component name. For example, you can import Button and DatePicker component props like this:

Note that there are two variations of props types: for polymorphic components and for regular components. Regular component props types include `React.ComponentProps<'X'>`, where `X` is the root element type, for example `'div'`.

Example of extending regular component props:

## [Polymorphic components props types](#polymorphic-components-props-types)

[Polymorphic component](https://mantine.dev/guides/polymorphic/) props types don't include `React.ComponentProps<'X'>` because their root element depends on the `component` prop value.

Example of extending [polymorphic component](https://mantine.dev/guides/polymorphic/) props:

## [Namespace types](#namespace-types)

All Mantine components export namespaces with related types. For example, [Button](https://mantine.dev/core/button/) component props can be accessed as `Button.Props`:

## [ElementProps type](#elementprops-type)

`ElementProps` is a utility type similar to `React.ComponentProps`, but with additional features. It replaces the native element's `style` prop with Mantine's [style prop](https://mantine.dev/styles/style/) and allows omitting properties that are passed as a second type.

## [MantineTheme type](#mantinetheme-type)

`MantineTheme` is a type of the [theme object](https://mantine.dev/theming/theme-object/). You can use it to add types to functions that accept a theme object as an argument:

## [MantineThemeOverride type](#mantinethemeoverride-type)

`MantineThemeOverride` type is a deep partial of `MantineTheme`. It can be used in functions that accept a theme override as an argument:

## [MantineColorScheme type](#mantinecolorscheme-type)

`MantineColorScheme` is a union of `'light' | 'dark' | 'auto'` values. You can use it to add types to functions that accept color scheme as an argument:

## [MantineSize type](#mantinesize-type)

`MantineSize` type is a union of `'xs' | 'sm' | 'md' | 'lg' | 'xl'` values. You can use it to add types to various props that accept size as an argument, for example, `radius`, `shadow`, `p`.

## [Theme object declarations](#theme-object-declarations)

You can change `theme.other` and `theme.colors` types by extending the `MantineTheme` interface in a `.d.ts` file. Create `mantine.d.ts` anywhere in your project (must be included in `tsconfig.json`) to extend theme object types.

To override `theme.other`:

To override `theme.colors`:

You can also customize size-related types for `theme.spacing`, `theme.radius`, `theme.breakpoints`, `theme.fontSizes`, `theme.lineHeights`, and `theme.shadows` similarly.

To override `theme.spacing` and `theme.radius`

Note that extending the theme type isn't required; it's only needed if you want to make your theme object types more strict and add autocomplete in your editor.

## [Custom variants types](#custom-variants-types)

You can define types for custom [variants](https://mantine.dev/styles/variants-sizes/) by extending the `{x}Props` interface with the new variant type in your `mantine.d.ts` file.

Example of adding a custom variant type to the [Button](https://mantine.dev/core/button/) component:
