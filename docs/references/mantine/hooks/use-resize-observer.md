## [Usage](#usage)

Resize me!

Resize element by dragging its right bottom corner
| Property | Value |
| --- | --- |
| width | 400 |
| height | 200 |

## [API](#api)

The `use-resize-observer` hook returns a `ref` object that should be passed to the observed element, and the current element content rect, as returned by the `ResizeObserver`'s callback `entry.contentRect`. See the [Resize Observer API](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) documentation to learn more. On the first render (as well as during SSR), or when no element is being observed, all of the properties are equal to `0`.

See also the [use-element-size](https://mantine.dev/hooks/use-element-size/) hook in case you need to subscribe only to `width` and `height`.

## [Definition](#definition)
