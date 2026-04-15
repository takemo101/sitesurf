# CSS modules

All Mantine components use CSS modules for styling. It is recommended to use CSS modules in your project as well, but it is not required – Mantine components are fully compatible with any third-party styling solution and native CSS.

## [Usage](#usage)

CSS modules are supported out of the box by all major frameworks and build tools. Usually, all you need to do is create a `*.module.css` file:

And then import it in your component:

## [How CSS modules work](#how-css-modules-work)

When you create a `*.module.css` file, your build tool will generate a unique class name for each class in your file. For example, when you import the following file in your `.js`/`.ts` file:

You will get an object with unique class names:

With CSS modules, you do not need to worry about class name collisions. You can use any class name you want.

## [Referencing global class names](#referencing-global-class-names)

To reference global class names in CSS Modules, you can use the `:global` selector:

The code above will compile to the following CSS:

## [Adding styles to Mantine components](#adding-styles-to-mantine-components)

You can add styles to most Mantine components using the `className` prop – the same way as you would with a regular HTML element. To set properties to your [theme](https://mantine.dev/theming/theme-object/) values, you can use [Mantine CSS variables](https://mantine.dev/styles/css-variables/):

Box component with some styles

To apply styles to inner elements of Mantine components with CSS modules, you can use the `classNames` prop (see [Styles API](https://mantine.dev/styles/styles-api/) for more information):

Floating label input

## [Styling Mantine components without CSS modules](#styling-mantine-components-without-css-modules)

All Mantine components are fully compatible with any third-party styling solution and native CSS. There are two main strategies to apply styles with a third-party library:

- `className`, `classNames`, `style` and `styles` props
- with static selectors, for example `.mantine-Text-root`

Example of applying styles with a utility CSS library:

Example of applying styles with global CSS:

You can combine both approaches to achieve the desired results. For example, the `@emotion/styled` and `styled-components` packages will pass the `className` prop to a given component, and you can use static selectors to style inner elements:

> **Consider using CSS modules first**
>
> CSS modules are the recommended way of styling Mantine components. Before choosing another styling solution, make sure that CSS modules do not fit your needs. Other solutions have limitations, for example:
>
> - It is hard to customize styles based on [data-\* attributes](https://mantine.dev/styles/data-attributes/) when using utility-based CSS libraries
> - It is impossible to style inner elements of Mantine components with static selectors when using styled-components and other similar libraries if the component uses [Portal](https://mantine.dev/core/portal/) because some elements will be rendered outside of the component root and inner elements are not part of the component tree
