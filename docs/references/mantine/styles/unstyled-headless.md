## Unstyled components

## [Using Mantine as a headless UI library](#using-mantine-as-a-headless-ui-library)

You can use Mantine as a headless UI library. To do that, simply do not import `@mantine/*/styles.css` in your application. Then you will be able to apply styles to Mantine components using the [Styles API](https://mantine.dev/styles/styles-api/) with a styling solution of your choice.

## [HeadlessMantineProvider](#headlessmantineprovider)

`HeadlessMantineProvider` is an alternative to [MantineProvider](https://mantine.dev/theming/mantine-provider/) that should be used when you want to use Mantine as a headless UI library. It removes all features that are related to Mantine styles:

- Mantine classes are not applied to components
- Inline CSS variables are not added with the `style` attribute
- All color scheme related features are removed
- Global styles are not generated

Limitations of `HeadlessMantineProvider`:

- [Color scheme switching](https://mantine.dev/theming/color-schemes/) will not work. If your application has a dark mode, you will need to implement it on your side.
- Props that are related to styles in all components (`color`, `radius`, `size`, etc.) will have no effect.
- Some components that rely on styles will become unusable ([Grid](https://mantine.dev/core/grid/), [SimpleGrid](https://mantine.dev/core/simple-grid/), [Container](https://mantine.dev/core/container/), etc.).
- `lightHidden`/`darkHidden`, `visibleFrom`/`hiddenFrom` props will not work.
- [Style props](https://mantine.dev/styles/style-props/) will work only with explicit values, for example `mt="xs"` will not work, but `mt={5}` will.

To use `HeadlessMantineProvider`, follow the [getting started guide](https://mantine.dev/getting-started/) and replace `MantineProvider` with `HeadlessMantineProvider`. Note that you do not need to use [ColorSchemeScript](https://mantine.dev/theming/color-schemes/#colorschemescript) in your application; it will not have any effect, so you can ignore this part of the guide.

## [unstyled prop](#unstyled-prop)

Most Mantine components support the `unstyled` prop that removes library styles from the component and allows you to style it from scratch. Note that the `unstyled` prop is not supported by compound components (`Tabs.Tab`, `Menu.Dropdown`, `Accordion.Control`, etc.) – it only works on the root component (`Tabs`, `Menu`, `Accordion`, etc.).

Unstyled [Tabs](https://mantine.dev/core/tabs/) component:

Chat panel

> **Choosing between unstyled prop and headless components**
>
> `unstyled` prop is useful when you want to remove library styles from a single component, but keep styles for other components. For example, if [Tabs](https://mantine.dev/core/tabs/) component does not meet your design system requirements, but all other components do, you can use `unstyled` prop to remove styles from Tabs and style it from scratch, while keeping all other components styled with Mantine styles.
>
> Note that `unstyled` prop does not remove Mantine library styles from your `.css` bundle – it only does not apply them to component with `unstyled` prop.
