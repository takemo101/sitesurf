# Styles overview

This guide will help you understand how to apply styles to Mantine and custom components.

## [Component specific props](#component-specific-props)

Most components provide props that allow you to customize their styles. For example, the [Button](https://mantine.dev/core/button/) component has `color`, `variant`, `size` and `radius` props that control its appearance:

Variant

Color

Size

Radius

These props usually control multiple CSS properties. For example, the `color` and `variant` props control `color`, `background-color` and `border` properties. In most cases, changing component props is the most optimal way to customize Mantine components.

## [Style props](#style-props)

[Style props](https://mantine.dev/styles/style-props/) work similarly to component-specific props, but with several differences:

- Style props are not component-specific; they can be used with any component.
- Style props always control a single CSS property. For example, the `c` prop controls the CSS `color` property, while the `color` prop controls a set of properties: `color`, `background-color` and `border-color`.
- Style props are set in the `style` attribute. It is not possible to override them with CSS without using `!important`.

[Style props](https://mantine.dev/styles/style-props/) are useful when you need to change a single CSS property without creating a separate file for styles. Some of the most common use cases are:

- Changing text color and font-size

- Applying margins to inputs inside a form:

- Adding padding to various elements:

Note that [style props](https://mantine.dev/styles/style-props/) were never intended to be used as a primary way of styling components. In most cases, it is better to limit the number of style props used per component to 3-4. If you find yourself using more than 4 style props, consider creating a separate file with styles – it will be easier to maintain and will be more [performant](https://mantine.dev/styles/styles-performance/).

## [Style prop](#style-prop)

[Style prop](https://mantine.dev/styles/style/) is supported by all Mantine components and allows setting CSS properties as well as CSS variables. It is useful in the following cases:

- You want to apply a single CSS property to a component:

- You want to set a CSS variable based on component prop:

[Style prop](https://mantine.dev/styles/style/) works the same way as React `style` prop. It is not recommended to use it as a primary way of styling components. In most cases, it is better to create a separate file with styles – it will be easier to maintain and will be more [performant](https://mantine.dev/styles/styles-performance/).

## [CSS modules](#css-modules)

[CSS modules](https://mantine.dev/styles/css-modules/) is the recommended way of applying most of the styles to Mantine components. CSS modules are the most performant and flexible way of styling components.

## [Theme tokens](#theme-tokens)

You can reference Mantine [theme](https://mantine.dev/theming/theme-object/) values in any styles with [CSS variables](https://mantine.dev/styles/css-variables/):

- In [CSS modules](https://mantine.dev/styles/css-modules/):

- In [style props](https://mantine.dev/styles/style-props/):

- In [style prop](https://mantine.dev/styles/style/):
