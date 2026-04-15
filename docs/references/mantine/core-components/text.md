## [Usage](#usage)

Extra small text

Small text

Default text

Large text

Extra large text

Semibold

Bold

Italic

Underlined

Strikethrough

Dimmed text

Blue text

Teal 4 text

Uppercase

capitalized text

Aligned to center

Aligned to right

## [Gradient variant](#gradient-variant)

When the `variant` prop is set to `gradient`, you can control the gradient with the `gradient` prop, which accepts an object with `from`, `to` and `deg` properties. If the`gradient` prop is not set, `Text` will use `theme.defaultGradient` which can be configured on the [theme object](https://mantine.dev/theming/theme-object/). The `gradient` prop is ignored when `variant` is not `gradient`.

Note that `variant="gradient"` supports only linear gradients with two colors. If you need a more complex gradient, use the [Styles API](https://mantine.dev/styles/styles-api/) to modify `Text` styles.

Gradient Text

Gradient from

Gradient to

Gradient degree

## [Truncate](#truncate)

Set the `truncate` prop to add `text-overflow: ellipsis` styles:

Lorem ipsum dolor sit amet consectetur adipisicing elit. Unde provident eos fugiat id necessitatibus magni ducimus molestias. Placeat, consequatur. Quisquam, quae magnam perspiciatis excepturi iste sint itaque sunt laborum. Nihil?

Truncate

Start

End

## [Line clamp](#line-clamp)

Specify the maximum number of lines with the `lineClamp` prop. This option uses [\-webkit-line-clamp](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp) CSS property ([caniuse](https://caniuse.com/css-line-clamp)). Note that `padding-bottom` cannot be set on the text element:

From Bulbapedia: Bulbasaur is a small, quadrupedal Pokémon that has blue-green skin with darker patches. It has red eyes with white pupils, pointed, ear-like structures on top of its head, and a short, blunt snout with a wide mouth. A pair of small, pointed teeth are visible in the upper jaw when its mouth is open. Each of its thick legs ends with three sharp claws. On Bulbasaur's back is a green plant bulb, which is grown from a seed planted there at birth. The bulb also conceals two slender, tentacle-like vines and provides it with energy through photosynthesis as well as from the nutrient-rich seeds contained within.

Size

Line clamp

Line clamp can also be used with any children (not only strings), for example with [Typography](https://mantine.dev/core/typography/):

### Line clamp with Typography

Lorem ipsum dolor sit amet consectetur adipisicing elit. Nesciunt nulla quam aut sed corporis voluptates praesentium inventore, sapiente ex tempore sit consequatur debitis non! Illo cum ipsa reiciendis quidem facere, deserunt eos totam impedit. Vel ab, ipsum veniam aperiam odit molestiae incidunt minus, sint eos iusto earum quaerat vitae perspiciatis.

## [Inherit styles](#inherit-styles)

Text always applies font-size, font-family and line-height styles, but in some cases this is not the desired behavior. To force Text to inherit parent styles, set the `inherit` prop. For example, highlight part of [Title](https://mantine.dev/core/title/):

### Title in which you want to highlight something

## [Polymorphic component](#polymorphic-component)

`Text` is a [polymorphic component](https://mantine.dev/guides/polymorphic/) – its default root element is `p`, but it can be changed to any other element or component with the `component` prop:

> Polymorphic components with TypeScript
>
> Note that polymorphic component prop types are different from regular components – they do not extend HTML element props of the default element. For example, `TextProps` does not extend `React.ComponentProps'<'div'>'` although `p` is the default element.
>
> If you want to create a wrapper for a polymorphic component that is not polymorphic (does not support the `component` prop), then your component props interface should extend HTML element props, for example:
>
> If you want your component to remain polymorphic after wrapping, use the `polymorphic` function described in [this guide](https://mantine.dev/guides/polymorphic/).

## [span prop](#span-prop)

Use the `span` prop as a shorthand for `component="span"`:
