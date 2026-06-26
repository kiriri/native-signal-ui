# Reactivity in JSX

A JSX expression evaluates to a **real DOM node** — not a description of one.
There is no render loop and no reconciliation. The unit of reactivity is usually
a `NativeSignal` or `Computed` from [`native-signal`](https://github.com/kiriri/Signal)
(imported from `native-signal/weak`). The runtime detects these automatically
wherever you use them, and also accepts plain values, arrays, Promises, and
objects exposing `to_html()`.

```tsx
import { NativeSignal } from "native-signal/weak";

const count = new NativeSignal(0);

const view = <button onclick={() => count.set(count.get() + 1)}>
    Clicked {count} times
</button>;

document.body.append(view);
```

`<button>` is created **once**. `{count}` is detected as a signal: the runtime
drops two comment anchors into the DOM and mounts a `Computed` between them that
re-renders **only that text node** when `count` changes. Nothing else re-runs.

## Reactive children

Pass a signal anywhere a child goes. The runtime mounts it between comment
anchors and updates that slice of DOM in place when it changes:

```tsx
const label = new Computed(() => `${user.get().first} ${user.get().last}`);

<span>Signed in as {label}</span>;
```

Children may also be: plain strings/numbers, DOM nodes and Fragments, arrays of children,
`Promise<Child>` (mounts a placeholder, swaps in the resolved value once), and
any object exposing `to_html()` (how control-flow helpers and `Component`s plug
in).

## Reactive attributes

Any attribute value that is a signal is bound reactively:

```tsx
const disabled = new NativeSignal(false);

<button disabled={disabled}>Save</button>;
```

Plain (non-signal) values are set once and never tracked. Falsy boolean / `null`
values remove the attribute; `true` sets it as a boolean attribute.

## `style:` and `class:` namespaced attributes

For precise per-property control there are namespaced attribute keys. These are
fully typed (the `style:` value type comes from `CSSStyleDeclaration`):

```tsx
const color  = new NativeSignal("red");
const isOpen = new NativeSignal(true);

<div
    style:color={color}            // single CSS property, reactive
    style:fontWeight="bold"        // single CSS property, static
    class:open={isOpen}            // toggles the `open` class (reactive boolean)
/>;
```

You can also pass a whole-`style` object or string:

```tsx
<div style={{ color: color, padding: "8px" }} />;   // per-key signals allowed
<div style="color: red; padding: 8px;" />;
```

## Events

`on*` props whose value is a function are attached with `addEventListener` (the
event name is the lowercased remainder, so `onclick` → `"click"`):

```tsx
<button onclick={(e) => console.log(e)}>Click</button>;
```

## Two-way form binding

`bind` wires a form element to a `NativeSignal` in both directions and returns an
unsubscribe function. It infers the event and coercion from the element type
(checkbox → boolean, number/range → number, multi-select → string[], else
string):

```tsx
import { bind } from "native-signal-ui";

const text = new NativeSignal("");
const el   = <input /> as HTMLInputElement;
const unbind = bind(el, text);            // bind(el, signal, { event, coerce })
```

One-call factories build the element and bind it in one step:

```ts
const [input,    cleanup] = boundInput("number", ageSignal, { placeholder: "Age" });
const [select,   cleanup] = boundSelect([{ value: "eq", label: "=" }], opSignal);
const [textarea, cleanup] = boundTextarea(bodySignal);
```

---

Next: [Control flow](./control-flow.md) · [Components](./components.md) ·
[Pitfalls (`own` / GC)](./pitfalls.md) · [API reference](./api.md)
