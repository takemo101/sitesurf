# style prop

All Mantine components that have a root element support the `style` prop. It works similarly to the React `style` prop, but with some additional features.

## [Style object](#style-object)

You can pass a style object to the `style` prop – in this case it works the same way as the React `style` prop. You can use Mantine [CSS variables](https://mantine.dev/styles/css-variables/) in the style object the same way as in [.css files](https://mantine.dev/styles/css-modules/).

## [Define CSS variables in style prop](#define-css-variables-in-style-prop)

You can define CSS variables in the style prop. Note that this only works with Mantine components:

## [Style function](#style-function)

You can pass a style function to the `style` prop – in this case it will be called with the [theme](https://mantine.dev/theming/theme-object/). It is useful when you need to access [theme](https://mantine.dev/theming/theme-object/) properties that are not exposed as [CSS variables](https://mantine.dev/styles/css-variables/), for example, properties from `theme.other`.

## [Styles array](#styles-array)

You can pass an array of style objects and/or functions to the `style` prop – in this case, all styles will be merged into one object. It is useful when you want to create a wrapper around a Mantine component, add inline styles and keep the option to pass the `style` prop to it.
