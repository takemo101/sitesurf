# Controlled vs Uncontrolled

All Mantine inputs support both controlled and uncontrolled modes. This guide will help you understand the difference between these two modes and when to use each of them.

## [Controlled components](#controlled-components)

A controlled component is a form element whose value is controlled by React state. The component's value is set by state, and changes are handled through event handlers that update that state. React becomes the single source of truth for the form data.

Example of a controlled `TextInput` component:

In this example, the input's value is always synchronized with the component's state. Every keystroke triggers a state update,which causes a re-render with the new value.

## [Uncontrolled components](#uncontrolled-components)

An uncontrolled component manages its own state internally through the DOM (or internal state), similar to traditional HTML form elements. React doesn't control the value directly. Instead, you use refs or DOM methods to access the current value when needed, typically on form submission.

Example of an uncontrolled `TextInput` component:

Here, the input maintains its own state. React only reads the value when explicitly requested through the ref.

## [Key differences](#key-differences)

The primary difference lies in where the state lives. Controlled components store state in React, while uncontrolled components store it in the DOM. This fundamental distinction affects how you interact with the component throughout its lifecycle.

With controlled components, you explicitly define the value prop and handle every change. With uncontrolled components, you set a defaultValue and let the DOM handle updates, only accessing the value when needed.

Controlled components require an onChange handler to remain interactive, whereas uncontrolled components work without any change handlers, just like standard HTML inputs.

## [When to use which](#when-to-use-which)

Use controlled components when:

- You need to validate or manipulate input values in real-time.
- You want to enforce specific formats or constraints on user input.
- You require immediate feedback or dynamic UI updates based on input changes.

Use uncontrolled components when:

- You want to simplify your code and reduce boilerplate for simple forms.
- You don't need to validate or manipulate input values until form submission.
- You are working with large forms where performance is a concern, and you want to minimize re-renders.

## [FormData and uncontrolled components](#formdata-and-uncontrolled-components)

Uncontrolled forms are often used with the [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) API, which allows you to easily collect form values without managing state for each input. All Mantine components support uncontrolled usage with `FormData`.

Example of using uncontrolled `Checkbox` with `FormData`:

## [Uncontrolled use-form](#uncontrolled-use-form)

[@mantine/form](https://mantine.dev/form/use-form/) supports uncontrolled mode which allows building large forms with good performance. If you are working on complex forms with many fields, `useForm` hook in uncontrolled mode is a great choice.

Example of uncontrolled mode with `useForm`:
