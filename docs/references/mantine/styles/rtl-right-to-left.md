## Right-to-left direction

All Mantine components support right-to-left direction out of the box. You can preview how components work with RTL direction by clicking the direction control in the top right corner or pressing `Ctrl + Shift + L`.

## [DirectionProvider](#directionprovider)

The `DirectionProvider` component is used to set direction for all components inside it. It is required to wrap your application with `DirectionProvider` if you are planning to either use RTL direction or change direction dynamically.

`DirectionProvider` supports the following props:

Setup `DirectionProvider` in your application:

## [dir attribute](#dir-attribute)

It is required to set the `dir` attribute on the root element of your application, usually the `html` element. The `DirectionProvider` will use its value to set direction on mount if the `detectDirection` prop is set to `true`. Note that this guide does not cover setting the `dir` attribute for different frameworks – follow your framework's documentation to learn how to do it.

## [useDirection hook](#usedirection-hook)

`useDirection` returns an object with the following properties:

- `dir` – current direction
- `setDirection` – function to set direction
- `toggleDirection` – function to change direction to the opposite value

You can use it to create direction control in your application:

## [rtl mixin](#rtl-mixin)

If you have [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) installed, then you can use the `rtl` mixin in `.css` files:

Demo
