## [Tree component](#tree-component)

New [Tree](https://mantine.dev/core/tree/) component:

- src

- node_modules

- package.json

- tsconfig.json

## [form.getInputNode](#formgetinputnode)

New `form.getInputNode(path)` handler returns input DOM node for the given field path. Form example, it can be used to focus input on form submit if there is an error:

## [Container queries in SimpleGrid](#container-queries-in-simplegrid)

You can now use [container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) in [SimpleGrid](https://mantine.dev/core/simple-grid/) component. With container queries, grid columns and spacing will be adjusted based on the container width, not the viewport width.

Example of using container queries. To see how the grid changes, resize the root element of the demo with the resize handle located at the bottom right corner of the demo:

1

2

3

4

5

## [Checkbox and Radio indicators](#checkbox-and-radio-indicators)

New [Checkbox.Indicator](https://mantine.dev/core/checkbox/#checkboxindicator) and [Radio.Indicator](https://mantine.dev/core/radio/#radioindicator) components look exactly the same as `Checkbox` and `Radio` components, but they do not have any semantic meaning, they are just visual representations of checkbox and radio states.

`Checkbox.Indicator` component:

`Radio.Indicator` component:

## [Checkbox and Radio cards](#checkbox-and-radio-cards)

New [Checkbox.Card](https://mantine.dev/core/checkbox/#checkboxcard-component) and [Radio.Card](https://mantine.dev/core/radio/#radiocard-component) components can be used as replacements for `Checkbox` and `Radio` to build custom cards/buttons/etc. that work as checkboxes and radios. Components are accessible by default and support the same keyboard interactions as `input[type="checkbox"]` and `input[type="radio"]`.

`Checkbox.Card` component:

`Checkbox.Card` component with `Checkbox.Group`:

Pick packages to install

Choose all packages that you will need in your application

CurrentValue: –

`Radio.Card` component:

`Radio.Card` component with `Radio.Group`:

Pick one package to install

Choose a package that you will need in your application

CurrentValue: –

## [bd style prop](#bd-style-prop)

New [bd style prop](https://mantine.dev/styles/style-props/) can be used to set `border` CSS property. It is available in all components that support style props.

Border width value is automatically converted to rem. For border color you can reference theme colors similar to other style props:
