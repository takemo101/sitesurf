## [CSS modules](#css-modules)

[CSS modules](https://mantine.dev/styles/css-modules/) is the most performant way to apply styles – this approach generates static CSS that is never re-evaluated. 99% of Mantine component styles are generated with CSS modules – components are optimized out of the box.

In most cases, it is recommended to use [CSS modules](https://mantine.dev/styles/css-modules/) to style your components as well. You can apply styles to HTML elements with the `className` prop and to Mantine components with the `className` and `classNames` props.

Applying styles with the `className`:

Box component with some styles

Applying styles with `classNames` (see the [Styles API guide](https://mantine.dev/styles/styles-api/) to learn more):

Floating label input

## [Inline styles](#inline-styles)

Inline styles (`style` and `styles` props) are less performant than CSS modules, but still performant enough to be used in most cases if they are your preferred way of styling in your project.

Inline styles caveats:

- Styles are not reused between components; each component will generate its own styles. For example, if you have 100 buttons with the same styles, CSS modules will generate 1 class for all of them, while inline styles will generate 100 `style` attributes
- If inline styles are overused, they can increase bundle size and output HTML size
- _Not performance related_: inline styles have higher specificity than CSS modules, so if you want to override inline styles you will have to use `!important` or use other inline styles

Example of inline styles:

## [Style props](#style-props)

[Style props](https://mantine.dev/styles/style-props/) transform component props into inline styles. Style props have the same caveats as inline styles. It is not recommended to use them as the primary means of styling your components. Usually, style props are used to apply 1–3 styles to a component – using them this way does not impact performance.

## [Responsive style props](#responsive-style-props)

Responsive [style props](https://mantine.dev/styles/style-props/) have worse performance than regular style props because they require injecting a `<style />` tag next to the component. It is fine to use responsive style props to apply styles to several components, but it is not recommended to use them in large lists of components. For example, if you have 1000 inputs with responsive margins, it is better to refactor to use the `classNames` prop:

## [Components responsive props](#components-responsive-props)

Some components, like [SimpleGrid](https://mantine.dev/core/simple-grid/) and [Grid](https://mantine.dev/core/grid/), rely on the same mechanism as responsive style props to apply styles. The limitations are the same – it is fine to use several of these components on a page, but it is not recommended to use them in large lists of components.
