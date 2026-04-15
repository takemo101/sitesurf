# data-\* attributes

Mantine components use `data-*` attributes to apply styles. These attributes are used as modifiers to apply styles based on component state. The general rule of Mantine component styles: one class with shared styles and any number of `data-*` attributes as modifiers.

Example of applying styles with `data-*` attributes:

## [data attributes values](#data-attributes-values)

Most of the `data-*` attributes do not have associated values. They represent boolean state or a feature. For example, when the `disabled` prop on [Button](https://mantine.dev/core/button/) is set, the `data-disabled` attribute is added to the `<button />` element:

Will output the following HTML:

You can then use this attribute to apply styles to the disabled button:

When the `disabled` prop is not set, the `data-disabled` attribute is not added to the button:

In some cases, `data-*` attributes have associated values. For example, a [Button](https://mantine.dev/core/button/) component's `section` element has an associated `data-position` attribute which can be `left` or `right`. The following example will render two `section` elements, one with `data-position="left"` and another with `data-position="right"`:

Will output the following HTML:

You can then use this attribute to apply styles to the left and right sections:

## [Components data attributes documentation](#components-data-attributes-documentation)

Every component that uses `data-*` attributes has a dedicated section under the `Styles API` tab.

The [Button](https://mantine.dev/core/button/) component `data-*` attributes table:

| Selector    | Attribute               | Condition               | Value                           |
| ----------- | ----------------------- | ----------------------- | ------------------------------- |
| root        | data-disabled           | `disabled` prop is set  | –                               |
| root, label | data-loading            | `loading` prop is set   | –                               |
| root        | data-block              | `fullWidth` prop is set | –                               |
| root        | data-with-left-section  | `leftSection` is set    | –                               |
| root        | data-with-right-section | `rightSection` is set   | –                               |
| section     | data-position           | –                       | Section position: left or right |

How to read the table:

- `selector` column – [Styles API](https://mantine.dev/styles/styles-api/) selector (or multiple selectors) to which data attribute is added
- `attribute` column – data attribute name
- `condition` column – condition based on which the data attribute is added to the element
- `value` column – value of the data attribute

## [mod prop](#mod-prop)

All components support the `mod` prop, which allows adding data attributes to the root element. CamelCase keys are converted to kebab-case. If a key starts with `data-`, the prefix is not duplicated.

Examples of using `mod` prop:
