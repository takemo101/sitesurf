## [Support Mantine development](#support-mantine-development)

You can now sponsor Mantine development with [OpenCollective](https://opencollective.com/mantinedev). All funds are used to improve Mantine and create new features and components.

[Sponsor Mantine](https://opencollective.com/mantinedev)

## [Styles API attributes](#styles-api-attributes)

You now can pass attributes to inner elements of all components that support Styles API with `attributes` prop. For example, it can be used to add data attributes for testing purposes:

## [Container grid strategy](#container-grid-strategy)

[Container](https://mantine.dev/core/container/) now supports `strategy="grid"` prop which enables more features.

Differences from the default `strategy="block"`:

- Uses `display: grid` instead of `display: block`
- Does not include default inline padding
- Does not set `max-width` on the root element (uses grid template columns instead)

Features supported by `strategy="grid"`:

- Everything that is supported by `strategy="block"`
- Children with `data-breakout` attribute take the entire width of the container's parent element
- Children with `data-container` inside `data-breakout` have the same width as the main grid column

Example of using breakout feature:

Main content

Breakout

Container inside breakout

## [Tooltip target](#tooltip-target)

New [Tooltip](https://mantine.dev/core/tooltip/) `target` prop is an alternative to `children`. It accepts a string (selector), an HTML element or a ref object with HTML element. Use `target` prop when you do not render tooltip target as JSX element.

Example of using `target` prop with a string selector:

## [HoverCard.Group](#hovercardgroup)

[HoverCard](https://mantine.dev/core/hover-card/) now supports delay synchronization between multiple instances using `HoverCard.Group` component:

## [use-selection hook](#use-selection-hook)

New [use-selection](https://mantine.dev/hooks/use-selection/) hook:

|     | Element position | Element name | Symbol | Atomic mass |
| --- | ---------------- | ------------ | ------ | ----------- |
|     | 6                | Carbon       | C      | 12.011      |
|     | 7                | Nitrogen     | N      | 14.007      |
|     | 39               | Yttrium      | Y      | 88.906      |
|     | 56               | Barium       | Ba     | 137.33      |
|     | 58               | Cerium       | Ce     | 140.12      |

## [autoSelectOnBlur prop](#autoselectonblur-prop)

[Select](https://mantine.dev/core/select/) and [Autocomplete](https://mantine.dev/core/autocomplete/) components now support `autoSelectOnBlur` prop. Use it to automatically select the highlighted option when the input loses focus. To see this feature in action: select an option with up/down arrows, then click outside the input:

Your favorite library

## [Source edit mode in RichTextEditor](#source-edit-mode-in-richtexteditor)

[RichTextEditor](https://mantine.dev/x/tiptap/) now supports source edit mode:

Source code control example

New line with **bold text**

New line with _italic_ _text_

## [Recharts 3 support](#recharts-3-support)

You can now use the latest [Recharts 3](https://recharts.org/en-US/) version with Mantine charts. `@mantine/charts` package was validated to work with both Recharts 2 and Recharts 3 versions. Note that, there might still be some minor issues with Recharts 3, you are welcome to report issues on GitHub.

## [Other changes](#other-changes)

- [Accordion](https://mantine.dev/core/accordion/) default `chevronSize` prop value was changed to `auto` to allow using dynamic icon sizes
- [Accordion](https://mantine.dev/core/accordion/) now supports `chevronIconSize` prop to configure size of the default chevron icon
- [AffixPosition](https://mantine.dev/core/affix/) type is now exported from `@mantine/core` package
- `errorProps`, `labelProps` and `descriptionProps` props of all inputs now have stricter types and better IDE autocomplete
- `TypographyStylesProvider` was renamed to just `Typography` to simplify usage. `TypographyStylesProvider` name is still available but marked as deprecated – it will be removed in `9.0.0` release.
- [Slider](https://mantine.dev/core/slider/) and [RangeSlider](https://mantine.dev/core/range-slider/) components now have separate documentation pages
