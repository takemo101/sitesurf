## [Adding custom variants](#adding-custom-variants)

Most Mantine components support the `variant` prop. It can be used in CSS variables resolver, and it is also exposed as a `data-variant="{value}"` attribute on the root element of the component. The easiest way to add custom variants is to add styles that use `[data-variant="{value}"]`.

Example of adding a new variant to the [Input](https://mantine.dev/core/input/) component:

- `underline` variant styles are added
- `filled` variant is the default variant – you do not need to define any additional styles for it

Note that you can add custom variants to every Mantine component that supports the [Styles API](https://mantine.dev/styles/styles-api/), even if there are no variants defined on the library side.

> **Overriding existing variants styles**
>
> Apart from adding new variants, you can also override existing ones, for example, you can change the `filled` variant of the [Input](https://mantine.dev/core/input/) component with `.input[data-variant="filled"]` selector.

## [Custom variants types](#custom-variants-types)

You can define types for custom variants by creating a `mantine.d.ts` file in your project and extending the `{x}Props` interface with the new variant type.

Example of adding a custom variant type to the [Button](https://mantine.dev/core/button/) component:

## [variantColorResolver](#variantcolorresolver)

[Button](https://mantine.dev/core/button/), [Badge](https://mantine.dev/core/badge/), [ActionIcon](https://mantine.dev/core/action-icon/) and other components support custom variants with [variantColorResolver](https://mantine.dev/theming/colors/#colors-variant-resolver) – it supports both changing colors and adding new variants. Note that `theme.variantColorResolver` is responsible only for colors. If you need to change other properties, use the `data-variant` attribute.

## [Sizes with components CSS variables](#sizes-with-components-css-variables)

You can add custom sizes to any component that supports the `size` prop by providing a custom CSS variables resolver. Usually this is done in `theme.components`:

## [Sizes with data-size attribute](#sizes-with-data-size-attribute)

Every component that supports the `size` prop exposes it as a `data-size="{value}"` attribute on the root element. You can use it to add custom sizes:

## [Sizes with static CSS variables](#sizes-with-static-css-variables)

Mantine component sizes are defined with CSS variables (usually on the root element). For example, the [ActionIcon](https://mantine.dev/core/action-icon/) component has the following CSS variables:

You can override these values with the [Styles API](https://mantine.dev/styles/styles-api/) or add new size values:

Note that some components have more than one CSS variable for size. For example, the [Button](https://mantine.dev/core/button/) component has the following CSS variables:

Usually, it is more convenient to use the `data-size` attribute or `vars` on the [theme](https://mantine.dev/theming/theme-object/) to customize sizes in this case.
