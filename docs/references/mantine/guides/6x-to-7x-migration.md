# 6.x to 7.x migration

This guide will help you migrate your project styles from 6.x to 7.x. It's not intended to be a comprehensive guide covering all changes in 7.x. For a complete overview, please see the [7.0.0 changelog](https://mantine.dev/changelog/7-0-0/).

## [Migration to @mantine/emotion](#migration-to-mantineemotion)

The `@mantine/emotion` package has been available since version 7.9. If you don't want to use CSS modules, have many styles created with `createStyles`, `sx` and `styles` props, or simply prefer CSS-in-JS syntax, you can migrate to `@mantine/emotion`. To view the full documentation for the `@mantine/emotion` package, visit [this page](https://mantine.dev/styles/emotion/).

### [createStyles and Global component](#createstyles-and-global-component)

The `createStyles` function and `Global` component are no longer available in the `@mantine/core` package. Change imports to `@mantine/emotion`:

### [sx and styles props](#sx-and-styles-props)

`sx` and `styles` props are available in 7.x the same way as in 6.x after [setup](https://mantine.dev/styles/emotion/):

### [theme.colorScheme](#themecolorscheme)

In v7, the color scheme value is managed by [MantineProvider](https://mantine.dev/theming/mantine-provider/), and the [theme object](https://mantine.dev/theming/theme-object/) no longer includes the `colorScheme` property. Although it's still possible to access the color scheme value in components with the [useMantineColorScheme](https://mantine.dev/theming/color-schemes/#use-mantine-color-scheme-hook) hook, it's not recommended to base your styles on its value. Instead, use the `light`/`dark` [utilities](https://mantine.dev/styles/emotion/#utilities).

Example of 6.x `createStyles` with `theme.colorScheme` migration to 7.0:

## [Migration to CSS modules](#migration-to-css-modules)

Before getting started, we recommend going through the [styles](https://mantine.dev/styles/css-modules/) documentation. The most notable sections are:

- [CSS Modules](https://mantine.dev/styles/css-modules/)
- [Mantine PostCSS preset](https://mantine.dev/styles/postcss-preset/)
- [CSS variables](https://mantine.dev/styles/css-variables/)
- [data-\* attributes](https://mantine.dev/styles/data-attributes/)
- [Styles API](https://mantine.dev/styles/styles-api/)
- [Responsive styles](https://mantine.dev/styles/responsive/)

Note that this guide assumes you have [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) installed and configured in your project.

### [createStyles](#createstyles)

The `createStyles` function is no longer available in 7.0. Use [CSS Modules](https://mantine.dev/styles/css-modules/) instead.

### [sx prop](#sx-prop)

The `sx` prop is no longer available in 7.0. Use `className` or the [style prop](https://mantine.dev/styles/style/) instead.

Nested selectors are not supported in the [style prop](https://mantine.dev/styles/style/); use `className` instead:

### [styles prop](#styles-prop)

The `styles` prop no longer supports nested selectors. Use `classNames` instead to apply styles to nested elements.

Regular selectors are still supported:

### [Global styles](#global-styles)

The `Global` component and global styles on the theme are not available in 7.0. Instead, create a global stylesheet (`.css` file) and import it at your application entry point.

### [theme referencing](#theme-referencing)

All [theme](https://mantine.dev/theming/theme-object/) properties are now available as [CSS variables](https://mantine.dev/styles/css-variables/). We recommend using [CSS variables](https://mantine.dev/styles/css-variables/) instead of referencing the theme object in styles.

### [theme.colorScheme](#themecolorscheme-1)

The color scheme value is managed by [MantineProvider](https://mantine.dev/theming/mantine-provider/), and the [theme object](https://mantine.dev/theming/theme-object/) no longer includes the `colorScheme` property. Although it's still possible to access the color scheme value in components with the [useMantineColorScheme](https://mantine.dev/theming/color-schemes/#use-mantine-color-scheme-hook) hook, it's not recommended to base your styles on its value. Instead, use the `light`/`dark` [mixins](https://mantine.dev/styles/postcss-preset/) or the `light-dark` CSS [function](https://mantine.dev/styles/postcss-preset/#light-dark-function).

Example of 6.x `createStyles` with `theme.colorScheme` migration to 7.0:

Note that if your application has server-side rendering, you should not render any elements based on its value ([more info](https://mantine.dev/theming/color-schemes/#color-scheme-value-caveats)). Instead, use the `light`/`dark` mixins or the `light-dark` function to hide/show elements based on the color scheme value.

Color scheme toggle example:
