## [What is a polymorphic component](#what-is-a-polymorphic-component)

A polymorphic component is a component whose root element can be changed with the `component` prop. All polymorphic components have a default element that's used when the `component` prop is not provided. For example, the [Button](https://mantine.dev/core/button/) component's default element is `button` and it can be changed to `a` or any other element or component:

## [renderRoot prop](#renderroot-prop)

`renderRoot` is an alternative to the `component` prop, which accepts a function that should return a React element. It is useful in cases when `component` prop cannot be used, for example, when the component that you want to pass to the `component` is generic (accepts type or infers it from props, for example `<Link<'/'> />`).

Example of using `renderRoot` prop, the result is the same as in the previous demo:

**!important** It's required to spread the `props` argument into the root element. Otherwise, there will be no styles and the component might not be accessible.

## [Polymorphic components as other React components](#polymorphic-components-as-other-react-components)

You can pass any other React component to the `component` prop. For example, you can pass the `Link` component from `react-router-dom`:

## [Polymorphic components as Next.js Link](#polymorphic-components-as-nextjs-link)

The Next.js link doesn't work in the same way as other similar components in all Next.js versions.

With Next.js 12 and below:

With Next.js 13 and above:

## [Polymorphic components with generic components](#polymorphic-components-with-generic-components)

You cannot pass generic components to the `component` prop because it's not possible to infer generic types from the component prop. For example, you cannot pass [typed Next.js Link](https://nextjs.org/docs/app/building-your-application/configuring/typescript#statically-typed-links) to the `component` prop because it's not possible to infer the `href` type from the component prop. The component itself will work correctly, but you'll have a TypeScript error.

To make generic components work with polymorphic components, use the `renderRoot` prop instead of `component`:

## [Polymorphic components with react-router NavLink](#polymorphic-components-with-react-router-navlink)

The [react-router-dom](https://reactrouter.com/en/main) [NavLink](https://reactrouter.com/en/main/components/nav-link) component's `className` prop accepts a function based on which you can add an active class to the link. This feature is incompatible with Mantine's `component` prop, but you can use the `renderRoot` prop instead:

## [Wrapping polymorphic components](#wrapping-polymorphic-components)

Non-polymorphic components include `React.ComponentProps<'x'>` as part of their props type, where `x` is the root element of the component. For example, the [Container](https://mantine.dev/core/container/) component is not polymorphic – its root element is always `div`, so its props type includes `React.ComponentProps<'div'>`.

Polymorphic components don't include `React.ComponentProps<'x'>` as part of their props type because their root element can be changed, and thus the props type can be inferred only after the component was rendered.

Example of creating a non-polymorphic wrapper component for Mantine polymorphic component:

Example of creating a polymorphic wrapper component for Mantine polymorphic component:

## [Dynamic component prop](#dynamic-component-prop)

You can use a dynamic value in the `component` prop, but in this case, you need to either provide types manually or disable type checking by passing `any` as a type argument to the polymorphic component:

## [Create your own polymorphic components](#create-your-own-polymorphic-components)

Use the `polymorphic` function and [Box](https://mantine.dev/core/box/) component to create new polymorphic components:

## [Make Mantine component polymorphic](#make-mantine-component-polymorphic)

Polymorphic components have a performance overhead for tsserver (no impact on runtime performance), because of that, not all Mantine components have polymorphic types, but all components still accept the `component` prop – the root element can be changed.

To make a Mantine component polymorphic, use the `polymorphic` function the same way as in the previous example:
