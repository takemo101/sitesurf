# Default props

You can define default props for every Mantine component by setting `theme.components`. These props will be used by default by all components in your application unless they are overridden by component props:

## [Default props with MantineThemeProvider](#default-props-with-mantinethemeprovider)

You can also use `MantineThemeProvider` to define default props for a part of your application:

## [Default props for compound components](#default-props-for-compound-components)

Some components like [Menu](https://mantine.dev/core/menu/) and [Tabs](https://mantine.dev/core/tabs/) have associated compound components: `Menu.Item`, `Tabs.List`, etc. You can add default props to these components by omitting the dot from the component name:

## [useProps hook](#useprops-hook)

You can use the `useProps` hook to add default props support to any custom component. `useProps` accepts three arguments:

- component name (string) – it is used to connect the component with the theme
- `defaultProps` – default props on the component level – these props are used when default props are not defined on the theme
- `props` – props passed to the component

Default color

Provider color

Prop color

## [withProps function](#withprops-function)

All Mantine components have a `withProps` static function that can be used to add default props to the component:
