# Mantine styles

This guide explains how to import styles of `@mantine/*` packages in your application and how to override them with [CSS layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) in case you do not have a way to control the order of stylesheets in your application.

## [Mantine components styles](#mantine-components-styles)

All Mantine components are built with CSS modules, but all styles are bundled before publishing to npm. To include these styles, you need to import the `@mantine/{package}/styles.css` file in your application. Example with the `@mantine/core` package:

By adding this import, you will have all styles of the `@mantine/core` components in your application.

## [Import styles per component](#import-styles-per-component)

If you want to reduce CSS bundle size, you can import styles per component. Note that some components have dependencies. For example, the [Button](https://mantine.dev/core/button/) component uses the [UnstyledButton](https://mantine.dev/core/unstyled-button/) component internally, so you need to import styles for both components. You can find a full list of exported styles from the `@mantine/core` package and additional instructions on [this page](https://mantine.dev/styles/css-files-list/).

Note that individual component styles are available only for the `@mantine/core` package. Other packages have minimal styles that can be imported with the `@mantine/{package}/styles.css` import.

## [Styles import order](#styles-import-order)

It is important to maintain the correct styles import order. The `@mantine/core` package styles must always be imported before any other Mantine package styles:

Your application styles must always be imported after all `@mantine/*` packages styles:

## [CSS layers](#css-layers)

Some bundlers and frameworks do not allow you to control the order of stylesheets in your application. For example, Next.js does not guarantee [styles import order](https://github.com/vercel/next.js/issues/16630). In this case, you can use [CSS layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) to ensure that your styles will always override Mantine styles.

All `@mantine/*` packages that export styles have an additional file in which all styles are wrapped in the `@layer mantine` directive.

These files contain the same styles as the `styles.css` files, but wrapped in the `@layer mantine` directive. Make sure that you do not import both `styles.css` and `styles.layer.css` files in your application.

Similar to package styles, you can import individual component styles with the `@layer mantine` directive:

## [How CSS layers work](#how-css-layers-work)

CSS rules within a layer are grouped together and applied before rules without a layer. This means that even if you do not have control over the styles import order, you can still override Mantine styles with regular styles.

CSS layers are also useful if you want to combine Mantine components with other libraries that also provide styles. You can use the `@layer` directive to control the order of styles:

In this example, Mantine styles will take precedence over other library `base` styles, but other library `components` styles will take precedence over Mantine component styles.

As of January 2026, CSS layers are supported in all modern browsers and have [95% browser support](https://caniuse.com/css-cascade-layers).

## [Loading styles from CDN](#loading-styles-from-cdn)

You can also load Mantine styles from the unpkg CDN. Note that in this case it is recommended to specify the exact version of `@mantine/*` packages both in your `package.json` and in CDN links.

Styles on the unpkg CDN are available for all Mantine packages that export styles.
