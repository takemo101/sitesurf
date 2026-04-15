## Create custom components

This guide will help you understand how to create custom components that integrate with Mantine's theming, styling, and other core features.

`ExampleComponent` will be used as an example throughout this guide:

## [Factory type](#factory-type)

`Factory` type is used to group all types related to the component: variant, Styles API selectors, ref type, CSS variables and other properties described later. All properties except `props` are optional.

The created `ExampleComponentFactory` is then passed as the first type argument to all helper functions imported from `@mantine/core` package: `useStyles`, `createVarsResolver` and `factory` in the example above.

`Factory` type is used for validation and IDE autocomplete. It does not modify the passed type:

## [factory function](#factory-function)

`factory` function is used to type props and assign shared static properties: `extend` and `withProps`.

## [Box component](#box-component)

[Box](https://mantine.dev/core/box/) component is a base for all other components. To create custom components, use it as the root element and spread `...others` props to it to support [style props](https://mantine.dev/styles/style-props/).

To add [style props](https://mantine.dev/styles/style-props/) types to component, extend `BoxProps`.

## [ElementProps type](#elementprops-type)

`ElementProps` is used to retrieve the props a component accepts. Can either be passed a string, indicating a DOM element (e.g. `'div'`, `'span'`, etc.) or the type of a React component. The second type argument is optional and may be used to omit props types from the original component/element.

`ElementProps` reassigns `style` prop signature to make it compatible with Mantine components and allow CSS variables usage.

Examples of `ElementProps` type usage:

## [useProps hook](#useprops-hook)

`useProps` hook is used to support [default props](https://mantine.dev/theming/default-props/). It accepts arguments:

- Component name which is used to reference component in [theme](https://mantine.dev/theming/theme-object/)
- Default props on component level
- Component props

`useProps` merges props using the order:

1. Component props – highest priority
2. [Default props](https://mantine.dev/theming/default-props/) on theme – lower priority
3. Default props define on component level – used only if prop is not defined in previous steps

Example of using `useProps`:

`defaultProps` passed to `useProps` must use `satisfies Partial<ExampleComponentProps>` type assertion to correctly type props:

You can use [defaultProps](https://mantine.dev/theming/default-props/) the following way:

## [useStyles hook](#usestyles-hook)

`useStyles` hook is used to support [Styles API](https://mantine.dev/styles/styles-api/) features: `classNames`, `styles`, `attributes` and other related properties.

`useStyles` returns `getStyles` function, which returns an object that should be spread (`{...getStyles('root')}`) to an element.

## [getStyles function](#getstyles-function)

`getStyles` function is returned by `useStyles` hook. The first argument is a Styles API selector, the second argument can be used to add `className` or `style` to the returned object.

## [varsResolver](#varsresolver)

Use `varsResolver` to transform component props into CSS variables.

Example of `varsResolver` usage in [Button](https://mantine.dev/core/button/) component:

## [Compound components](#compound-components)

Compound components (`Button.Group`, `Input.Wrapper`, etc.) are defined as static properties on the main component and assigned as type in the main component factory.

Example of assigning compound components in [Tabs](https://mantine.dev/core/tabs/) component:

## [Namespace exports](#namespace-exports)

Mantine components support namespace exports to group related types with the component. For example, `Button` component exports related types as `Button.*`:

To implement this feature, add namespace exports at the end of the component file or `index.ts`. Example of [Button](https://mantine.dev/core/button/) component namespace exports:

## [polymorphicFactory](#polymorphicfactory)

`polymorphicFactory` is used to create [polymorphic components](https://mantine.dev/guides/polymorphic/). Use `polymorphicFactory` instead of `factory` if you need to change the root element. For example, [Button](https://mantine.dev/core/button/) component is polymorphic: the default root element is `button`, but it can be changed to `a` or any other element using `component` and `renderRoot` props.

`polymorphicFactory` operates only with types, it does not modify the component behavior compared to `factory`. Types of components created with `polymorphicFactory` add overhead for TypeScript and slow down IDE autocomplete, use it only when necessary.

Full polymorphic component example:

## [genericFactory](#genericfactory)

Use `genericFactory` to create components accepting generic type arguments. For example, [Accordion](https://mantine.dev/core/accordion/) component `value` and `onChange` props type depend on the `multiple` prop value.
