## [Portal reuseTargetNode prop](#portal-reusetargetnode-prop)

[Portal](https://mantine.dev/core/portal/) component now supports `reuseTargetNode` prop which allows to reuse the same target node for all instances. This option is more performant than the previous behavior, it is recommended to be enabled. This option will be enabled by default in the `8.0` major release.

To enable reuseTargetNode option in all components that depend on Portal, add the following code to your [theme](https://mantine.dev/theming/theme-object/):

Example usage. In the following example, all three paragraphs will be rendered in the same target node:

## [use-form formRootRule](#use-form-formrootrule)

`formRootRule` is a special rule path that can be used to [validate](https://mantine.dev/form/validation/) objects and arrays alongside with their nested fields. For example, it is useful when you want to capture a list of values, validate each value individually and then validate the list itself to not be empty:

Name

Status

Active

Another example is to validate an object fields combination:

## [isJSONString and isNotEmptyHTML form validators](#isjsonstring-and-isnotemptyhtml-form-validators)

New `isJSONString` and `isNotEmptyHTML` [form validators](https://mantine.dev/form/validators/):

- `isNotEmptyHTML` checks that form value is not an empty HTML string. Empty string, string with only HTML tags and whitespace are considered to be empty.
- `isJSONString` checks that form value is a valid JSON string.

## [Popover onDismiss](#popover-ondismiss)

[Popover](https://mantine.dev/core/popover/) now supports `onDismiss` prop, which makes it easier to subscribe to outside clicks and escape key presses to close popover:

## [MantineProvider env](#mantineprovider-env)

[MantineProvider](https://mantine.dev/theming/mantine-provider/) component now supports `env` prop. It can be used in test environment to disable some features that might impact tests and/or make it harder to test components:

- transitions that mount/unmount child component with delay
- portals that render child component in a different part of the DOM

To enable test environment, set `env` to `test`:

## [use-file-dialog hook](#use-file-dialog-hook)

New [use-file-dialog](https://mantine.dev/hooks/use-file-dialog/) allows capturing one or more files from the user without file input element:

## [Remix deprecation](#remix-deprecation)

[Remix](https://remix.run/) is deprecated, the documentation related to Remix integration was removed, use [React Router](https://mantine.dev/guides/react-router/) instead. To simplify maintenance, Remix/React Router templates were archived and will not be updated.

## [Help center updates](#help-center-updates)

- [I get hydration warning about data-mantine-color-scheme attribute, what does it mean?](https://help.mantine.dev/q/color-scheme-hydration-warning) question
- [How can I apply styles to all Mantine components?](https://help.mantine.dev/q/apply-styles-to-all) question

## [Other changes](#other-changes)

- [Tooltip](https://mantine.dev/core/tooltip/) now supports customizing `middlewares`
- [ScrollArea](https://mantine.dev/core/scroll-area/) now supports `overscrollBehavior` prop
- [Affix](https://mantine.dev/core/affix/) now supports `theme.spacing` values for `position` prop
- [Anchor](https://mantine.dev/core/anchor/) now supports `underline="not-hover"` option to display underline only when the link is not hovered
