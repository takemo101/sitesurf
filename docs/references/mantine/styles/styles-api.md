## [What is Styles API](#what-is-styles-api)

The Styles API is a set of props and techniques that allows you to customize the style of any element inside a Mantine component – inline or using the [theme object](https://mantine.dev/theming/theme-object/). All Mantine components that have styles support the Styles API.

## [Styles API selectors](#styles-api-selectors)

Every Mantine component that supports the Styles API has a set of element names that can be used to apply styles to inner elements inside the component. For simplicity, these element names are called selectors in the Mantine documentation. You can find selector information under the `Styles API` tab in a component's documentation.

Example of the [Button](https://mantine.dev/core/button/) component selectors:

| Selector | Static selector          | Description                                                 |
| -------- | ------------------------ | ----------------------------------------------------------- |
| root     | .mantine-Button\-root    | Root element                                                |
| loader   | .mantine-Button\-loader  | Loader component, displayed only when `loading` prop is set |
| inner    | .mantine-Button\-inner   | Contains all other elements, child of the `root` element    |
| section  | .mantine-Button\-section | Left and right sections of the button                       |
| label    | .mantine-Button\-label   | Button children                                             |

You can use these selectors in `classNames` and `styles` in both component props and `theme.components`:

## [classNames prop](#classnames-prop)

With the `classNames` prop you can add classes to inner elements of Mantine components. It accepts an object with element names as keys and classes as values:

Floating label input

## [classNames in theme.components](#classnames-in-themecomponents)

You can also define `classNames` in [`theme.components`](https://mantine.dev/theming/theme-object/) to apply them to all components of a specific type:

## [Components CSS variables](#components-css-variables)

Most of Mantine components use CSS variables to define colors, sizes, paddings and other properties. You can override these values using a custom CSS variables resolver function in [theme.components](https://mantine.dev/theming/theme-object/) or by passing it to the `vars` prop.

You can find CSS variables information under the `Styles API` tab in a component's documentation. Example of [Button](https://mantine.dev/core/button/) component CSS variables:

| Selector              | Variable                                      | Description           |
| --------------------- | --------------------------------------------- | --------------------- |
| root                  | \--button-bg                                  | Controls `background` |
| \--button-bd          | Control `border`                              |
| \--button-hover       | Controls `background` when hovered            |
| \--button-color       | Control text `color`                          |
| \--button-hover-color | Control text `color` when hovered             |
| \--button-radius      | Controls `border-radius`                      |
| \--button-height      | Controls `height` of the button               |
| \--button-padding-x   | Controls horizontal `padding` of the button   |
| \--button-fz          | Controls `font-size` of the button            |
| \--button-justify     | Controls `justify-content` of `inner` element |

Example of a custom CSS variables resolver function used to add more sizes to the [Button](https://mantine.dev/core/button/) component:

## [styles prop](#styles-prop)

The `styles` prop works the same way as `classNames`, but applies inline styles. Note that inline styles have higher specificity than classes, so you will not be able to override them with classes without using `!important`. You cannot use pseudo-classes (for example, `:hover`, `:first-of-type`) and media queries inside the `styles` prop.

> **styles prop usage**
>
> Some examples and demos in the documentation use the `styles` prop for convenience, but it is not recommended to use the `styles` prop as the primary means of styling components, as the `classNames` prop is more flexible and has [better performance](https://mantine.dev/styles/styles-performance/).

## [Styles API based on component props](#styles-api-based-on-component-props)

You can also pass a callback function to `classNames` and `styles`. This function will receive [theme](https://mantine.dev/theming/theme-object/) as first argument and component props as second. It should return an object of classes (for `classNames`) or styles (for `styles`).

You can use this feature to conditionally apply styles based on component props. For example, you can change the [TextInput](https://mantine.dev/core/text-input/) label color if the input is required or change the input background color if the input is wrong:

Required input

Input with error

## [Static classes](#static-classes)

Every component that supports Styles API also includes static classes that can be used to style component without using `classNames` or `styles` props. By default, static classes have `.mantine-{ComponentName}-{selector}` format. For example, `root` selector of [Button](https://mantine.dev/core/button/) component will have `.mantine-Button-root` class.

You can use static classes to style a component with CSS or [any other styling solution](https://mantine.dev/styles/css-modules/#styling-mantine-components-without-css-modules):

The prefix of static classes can be changed with `classNamesPrefix` of [MantineProvider](https://mantine.dev/theming/mantine-provider/#classnamesprefix).

## [Components classes](#components-classes)

Classes of each component are available in the `Component.classes` object. For example, you can find the classes of [Button](https://mantine.dev/core/button/) in `Button.classes`:

| Key          | Class      |
| ------------ | ---------- |
| root         | m_77c9d27d |
| inner        | m_80f1301b |
| label        | m_811560b9 |
| section      | m_a74036a  |
| loader       | m_a25b86ee |
| group        | m_80d6d844 |
| groupSection | m_70be2a01 |

You can use these classes to create components with the same styles as Mantine components:

## [Attributes](#attributes)

You can pass attributes to inner elements of Mantine components using the `attributes` prop. For example, it can be used to add data attributes for testing purposes:
