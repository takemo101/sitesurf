## [AngleSlider component](#angleslider-component)

New [AngleSlider](https://mantine.dev/core/angle-slider/) component:

0°

0°

## [RadialBarChart component](#radialbarchart-component)

New [RadialBarChart](https://mantine.dev/charts/radial-bar-chart/) component:

## [FunnelChart component](#funnelchart-component)

New [FunnelChart](https://mantine.dev/charts/funnel-chart/) component:

## [Modal.Stack and Drawer.Stack components](#modalstack-and-drawerstack-components)

New [Modal.Stack](https://mantine.dev/core/modal/) and [Drawer.Stack](https://mantine.dev/core/drawer/) components simplify usage of multiple modals/drawers at the same time.

Use `Modal.Stack` component to render multiple modals at the same time. `Modal.Stack` keeps track of opened modals, manages z-index values, focus trapping and `closeOnEscape` behavior. `Modal.Stack` is designed to be used with `useModalsStack` hook.

Differences from using multiple `Modal` components:

- `Modal.Stack` manages z-index values – modals that are opened later will always have higher z-index value disregarding their order in the DOM
- `Modal.Stack` disables focus trap and `Escape` key handling for all modals except the one that is currently opened
- Modals that are not currently opened are present in the DOM but are hidden with `opacity: 0` and `pointer-events: none`
- Only one overlay is rendered at a time

## [useModalsStack/useDrawersStack hooks](#usemodalsstackusedrawersstack-hooks)

`useModalsStack` hook provides an easy way to control multiple modals at the same time. It accepts an array of unique modals ids and returns an object with the following properties:

Example of using `useModalsStack` with `Modal` component:

## [Restrict Slider selection to marks](#restrict-slider-selection-to-marks)

[Slider](https://mantine.dev/core/slider/) component now supports `restrictToMarks` prop that restricts slider value to marks only. Note that in this case `step` prop is ignored:

## [BarChart SVG pattern fill](#barchart-svg-pattern-fill)

[BarChart](https://mantine.dev/charts/bar-chart/) now can be used with SVG pattern fill:

## [Help center updates](#help-center-updates)

- New [Can I use nested inline styles with Mantine components?](https://help.mantine.dev/q/nested-inline-styles) question
- New [Can I use PostCSS function in inline styles?](https://help.mantine.dev/q/postcss-fns-inline) question
- New [Why my Carousel slides are in vertical orientation?](https://help.mantine.dev/q/carousel-missing-styles) question
- New [My buttons are transparent and the background is visible only on hover, what is wrong?](https://help.mantine.dev/q/transparent-buttons) question
- New [Can I have different primary color for light and dark color schemes?](https://help.mantine.dev/q/primary-virtual-color) question
- New [How can I change body background color?](https://help.mantine.dev/q/body-background) question
- New [My Popover dropdown closes when I click on the dropdown of nested Popover](https://help.mantine.dev/q/nested-popover-closes) question

## [Other changes](#other-changes)

- [useTree](https://mantine.dev/core/tree/) hook now accepts `onNodeExpand` and `onNodeCollapse` callbacks
- [useTree](https://mantine.dev/core/tree/) hook now returns additional `checkAllNodes`, `uncheckAllNodes` and `setCheckedState` handlers
- [Tree](https://mantine.dev/core/tree/) component now includes `getTreeExpandedState` to generate expanded state based on the tree data
- [use-form](https://mantine.dev/form/use-form/) now supports `form.replaceListItem` handler to replace list item at given index
