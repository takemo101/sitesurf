## [CSS layers](#css-layers)

Starting from 7.1.0 it is possible to import all `@mantine/*` packages styles with rules defined in `mantine` [CSS layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer). CSS rules within a layer are grouped together and applied before rules without a layer. This means that even if you do not have control over styles import order, you can still override Mantine styles with regular styles.

You can import styles within a layer by importing `@mantine/*/styles.layer.css` files. Note that these files are a full replacement for `@mantine/*/styles.css` files – you should not import both of them.

CSS layers are also useful if you want to combine Mantine components with other libraries which also provide styles. You can use `@layer` directive to control the order of styles:

In this example, Mantine styles will take precedence over other library `base` styles, but other library `components` styles will take precedence over Mantine component styles.

As of September 2023, CSS layers are supported in all modern browsers and have [90% browser support](https://caniuse.com/css-cascade-layers).

## [renderRoot prop](#renderroot-prop)

All [polymorphic](https://mantine.dev/guides/polymorphic/) components now support `renderRoot` prop, which is an alternative to `component` prop. `renderRoot` prop allows changing the root element to any other component or HTML tag with a callback function. It can be used in cases when `component` prop is not flexible enough:

- Target component props are incompatible with Mantine component. For example, [Button](https://mantine.dev/core/button/) component expects `className` to be a string, but [react-router-dom NavLink](https://reactrouter.com/en/6.16.0/components/nav-link) expects `className` to be a function.
- Target component is a generic – it either accepts type as a parameter or its type changes depending on its props. Examples: [typed Next.js Link](https://nextjs.org/docs/app/building-your-application/configuring/typescript#statically-typed-links), [TanStack router Link](https://tanstack.com/router/v1)

`renderRoot` example with [react-router-dom NavLink](https://reactrouter.com/en/6.16.0/components/nav-link):

`renderRoot` example with [typed Next.js Link](https://nextjs.org/docs/app/building-your-application/configuring/typescript#statically-typed-links):

## [Improved ESM support](#improved-esm-support)

All `@mantine/*` packages now have improved ESM support:

- Files in `esm` folder now have `.mjs` extension
- You can use `@mantine/*` packages with `type: module` in `package.json` without any additional configuration
- Tree shaking was improved for some bundlers

## [CSS variables in style prop](#css-variables-in-style-prop)

It is now possible to define CSS variables in `style` prop in all Mantine components – [style](https://mantine.dev/styles/style/) prop is no longer restricted by `React.CSSProperties` type:

## [form.setInitialValues](#formsetinitialvalues)

[@mantine/form](https://mantine.dev/form/values/#setinitialvalues-handler) now supports `form.setInitialValues` method which allows updating initial values after the form was initialized. This method is useful when you want to update values that are used in `form.reset` and to compare values for dirty fields state:
