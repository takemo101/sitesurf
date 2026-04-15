## [Notifications at any position](#notifications-at-any-position)

It is now possible to display notifications at any position on the screen with [@mantine/notifications package](https://mantine.dev/x/notifications/):

## [Subscribe to notifications state](#subscribe-to-notifications-state)

You can now subscribe to notifications state changes with `useNotifications` hook:

Notifications state

\[\]

Notifications queue

\[\]

## [SemiCircleProgress component](#semicircleprogress-component)

New [SemiCircleProgress](https://mantine.dev/core/semi-circle-progress/) component:

Label

Fill direction

Right to left

Left to right

Orientation

Up

Down

Filled segment color

Size

Thickness

Value

## [Tree checked state](#tree-checked-state)

[Tree](https://mantine.dev/core/tree/) component now supports checked state:

- src

- node_modules

- package.json

- tsconfig.json

## [Disable specific features in postcss-preset-mantine](#disable-specific-features-in-postcss-preset-mantine)

You can now disable specific features of the [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) by setting them to `false` in the configuration object. This feature is available starting from `postcss-preset-mantine@1.17.0`.

## [Help Center updates](#help-center-updates)

- [Server components guide](https://help.mantine.dev/q/server-components) has been updated to include `Component.extend` usage in server components.
- [A guide on applying input focus styles](https://help.mantine.dev/q/input-focus-styles) has been updated to work correctly with [PasswordInput](https://mantine.dev/core/password-input/) and other components in which the `input` selector is not used for actual input element.
- The guide on [how to disable all inputs in the form](https://help.mantine.dev/q/disable-all-inputs-in-form) now includes additional instructions for [use-form](https://mantine.dev/form/use-form/).
- New [Can I have color schemes other than light and dark?](https://help.mantine.dev/q/light-dark-is-not-enough) guide explains the difference between color scheme and theme and why Mantine does not support custom color schemes.
- New [Why VSCode cannot autoimport Text component?](https://help.mantine.dev/q/why-vscode-cannot-autoimport-text) guide explains why VSCode cannot automatically import `Text` component.
- New [Are Mantine components accessible?](https://help.mantine.dev/q/are-mantine-components-accessible) question
- New [How can I focus the first input with error with use-form?](https://help.mantine.dev/q/focus-first-input-with-error) question
- New [How to scroll to the top of the form if the form is submitted with errors?](https://help.mantine.dev/q/scroll-to-the-top-of-the-form) question
- New [Why my notifications are displayed at a wrong position?](https://help.mantine.dev/q/notifications-missing-styles) question
- New [Why my screen is completely empty after I've added notifications package?](https://help.mantine.dev/q/notifications-empty-screen) question
- New [Why can I not use value/label data structure with Autocomplete/TagsInput?](https://help.mantine.dev/q/autocomplete-value-label) question
- New [Why FileButton does not work in Menu?](https://help.mantine.dev/q/file-button-in-menu) question
- New [How can I display different elements in light and dark color schemes?](https://help.mantine.dev/q/light-dark-elements) question

## [Other changes](#other-changes)

- [use-interval](https://mantine.dev/hooks/use-interval/) hook now supports `autoInvoke` option to start the interval automatically when the component mounts.
- [use-form](https://mantine.dev/form/use-form/) with `mode="uncontrolled"` now triggers additional rerender when dirty state changes to allow subscribing to form state changes.
- [ScrollArea](https://mantine.dev/core/scroll-area/) component now supports `onTopReached` and `onBottomReached` props. The functions are called when the user scrolls to the top or bottom of the scroll area.
- [Accordion.Panel](https://mantine.dev/core/accordion/) component now supports `onTransitionEnd` prop that is called when the panel animation completes.
