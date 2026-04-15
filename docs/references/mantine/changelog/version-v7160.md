## [use-scroll-spy hook](#use-scroll-spy-hook)

New [use-scroll-spy](https://mantine.dev/hooks/use-scroll-spy/) hook tracks scroll position and returns index of the element that is currently in the viewport. It is useful for creating table of contents components (like in mantine.dev sidebar on the right side) and similar features.

Scroll to heading:

## [TableOfContents component](#tableofcontents-component)

New [TableOfContents](https://mantine.dev/core/table-of-contents/) component is built on top of `use-scroll-spy` hook and can be used to create table of contents components like the one on the right side of mantine.dev documentation sidebar:

Variant

Filled

Light

None

Color

Size

Radius

## [Input.ClearButton component](#inputclearbutton-component)

New `Input.ClearButton` component can be used to add clear button to custom inputs based on `Input` component. `size` of the clear button is automatically inherited from the input:

Size

## [Popover with overlay](#popover-with-overlay)

[Popover](https://mantine.dev/core/popover/) and other components based on it now support `withOverlay` prop:

## [Container queries in Carousel](#container-queries-in-carousel)

You can now use [container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) in [Carousel](https://mantine.dev/x/carousel/) component. With container queries, all responsive values are adjusted based on the container width, not the viewport width.

Example of using container queries. To see how the grid changes, resize the root element of the demo with the resize handle located at the bottom right corner of the demo:

Slide 1 of 6

1

2

3

4

5

6

## [RangeSlider restrictToMarks](#rangeslider-restricttomarks)

[RangeSlider](https://mantine.dev/core/range-slider/) component now supports `restrictToMarks` prop:

## [Pagination withPages prop](#pagination-withpages-prop)

[Pagination](https://mantine.dev/core/pagination/) component now supports `withPages` prop which allows hiding pages controls and displaying only previous and next buttons:

Showing 1 – 10 of 145

## [useForm touchTrigger option](#useform-touchtrigger-option)

[use-form](https://mantine.dev/form/use-form/) hook now supports `touchTrigger` option that allows customizing events that change touched state. It accepts two options:

- `change` (default) – field will be considered touched when its value changes or it has been focused
- `focus` – field will be considered touched only when it has been focused

Example of using `focus` trigger:

## [Help Center updates](#help-center-updates)

- [Native browser validation does not work in some components, what should I do?](https://help.mantine.dev/q/native-required) question
- [My styles are broken with disabled JavaScript. What should I do?](https://help.mantine.dev/q/disabled-js) question
- [How can I add fuzzy search to Select component?](https://help.mantine.dev/q/select-fuzzy) question
- [use-local-storage hook returns real value only after mounting, is it a bug?](https://help.mantine.dev/q/local-storage-effect) question
- [How can I upload files from Dropzone component?](https://help.mantine.dev/q/dropzone-upload) question

## [Other changes](#other-changes)

- [Autocomplete](https://mantine.dev/core/autocomplete/) now supports `clearable` prop
- [where-\* mixins](https://mantine.dev/styles/postcss-preset/#where--mixins) documentation has been added
- [use-local-storage](https://mantine.dev/hooks/use-local-storage/) hook now supports `sync` option which allows disabling synchronization between browser tabs
