# native-signal-ui

A minimal, signal-based UI library. No virtual DOM, no diffing, no component
re-renders — you build **real DOM nodes** with JSX, and individual signals wire
themselves directly to the attributes and text nodes that depend on them. When a
signal changes, only the exact DOM that reads it updates.

It is built on top of [**native-signal**](https://github.com/kiriri/Signal), my
framework-independent signal library (Angular-style signals, but standalone and
fast). `native-signal` is a runtime dependency — all reactivity comes from there;
this package is just the thin DOM-binding layer on top.

---

## Table of contents

- [Mental model](#mental-model)
- [Installation (Vite + TypeScript)](#installation-vite--typescript)
  - [1. Install](#1-install)
  - [2. Configure the JSX factory](#2-configure-the-jsx-factory)
  - [3. Make `tsc` aware of the global JSX types](#3-make-tsc-aware-of-the-global-jsx-types)
  - [4. Sanity check](#4-sanity-check)
- [Quick start](#quick-start)
- [Reactivity in JSX](#reactivity-in-jsx)
  - [Reactive children](#reactive-children)
  - [Reactive attributes](#reactive-attributes)
  - [`style:` and `class:` namespaced attributes](#style-and-class-namespaced-attributes)
  - [Events](#events)
- [Control flow](#control-flow)
  - [`If`](#if)
  - [`AB`](#ab)
  - [`Switch`](#switch)
  - [`ForKeyed`](#forkeyed)
- [Two-way form binding](#two-way-form-binding)
- [Components](#components)
- [`own(value, ...owners)`](#ownvalue-owners)
- [API reference](#api-reference)
- [Scripts](#scripts)
- [License](#license)

---

## Mental model

A JSX expression evaluates to a **DOM node** (an `HTMLElement`,
`DocumentFragment`, `Text`, etc.) — not a description of one. There is no render
loop and no reconciliation:

```tsx
const count = new NativeSignal(0);

const view = <button onclick={() => count.set(count.get() + 1)}>
    Clicked {count} times
</button>;

document.body.append(view);
```

- `<button>` is created **once** as a live `HTMLButtonElement`.
- `{count}` is detected as a signal. The runtime drops two comment anchors into
  the DOM and mounts a `Computed` between them that re-renders **only that text
  node** when `count` changes.
- Nothing else re-runs. The `onclick` handler, the surrounding text, the element
  itself — all built once and left alone.

The whole library is roughly: a JSX factory (`h`), a `normalize_child` routine
that knows how to mount each kind of child (nodes, strings, signals, promises,
arrays, `{ to_html() }` objects), and a handful of control-flow helpers that
manage anchor-delimited "slots" of DOM.

---

## Installation (Vite + TypeScript)

This is the part that trips people up, because the library uses the **classic**
JSX transform (a custom factory `h` / fragment `Fragment`) rather than the
React 17+ automatic runtime. You have to tell **both** TypeScript and Vite's
esbuild about the factory, and you have to make the global `JSX` namespace
visible to `tsc`. Here is the full, working setup.

### 1. Install

```bash
npm install native-signal-ui
# native-signal comes along as a dependency
```

### 2. Configure the JSX factory

The factory functions are exported under the `runtime` namespace
(`runtime.h`, `runtime.Fragment`). Point both the type-checker and the bundler
at them.

**`tsconfig.json`** — esbuild (and therefore Vite) reads these same compiler
options out of `tsconfig.json`, so configuring them here covers both type
checking *and* the build:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,

    // ── JSX: classic transform pointed at native-signal-ui ──────────────
    "jsx": "react",
    "jsxFactory": "runtime.h",
    "jsxFragmentFactory": "runtime.Fragment"
  },
  "include": ["src"]
}
```

> **Skip the per-file import of h/Fragment.** 
> Most compilers have a way to inject jsx specific code into tsx/jsx files.
> Here's how to do it in vite's config file: 
>
> ```ts
> import { defineConfig } from "vite";
>
> export default defineConfig({
>   esbuild: {
>     jsxFactory: "runtime.h",
>     jsxFragment: "runtime.Fragment",
>     // injected into every JSX module so `runtime` is always in scope
>     jsxInject: `import { runtime } from "native-signal-ui"`,
>   },
> });
> ```

### 3. Make typescript (`tsc`) aware of the global JSX types

This package augments the **global `JSX` namespace** (so that
`JSX.IntrinsicElements`, `JSX.Element`, `style:*` / `class:*` attribute typing,
etc. all exist). That augmentation lives in the package and is activated by
*importing* the package's types. If `tsc` complains about things like
*"JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists"*
it means the global types were never loaded into your project.

Fix it by adding a single ambient declaration file that pulls them in. Create
**`src/signal-ui.d.ts`** (any name ending in `.d.ts` that's covered by your
`include` works):

```ts
/// <reference types="native-signal-ui" />
```

That triple-slash reference loads the package's entry types, which in turn run
the `declare global { namespace JSX { … } }` augmentation, making the JSX
namespace visible across your whole project.

> If for some reason the reference form doesn't resolve in your setup, the
> equivalent side-effect import works too:
>
> ```ts
> import "native-signal-ui";
> export {};
> ```

### 4. Sanity check

A minimal `src/main.tsx` that should type-check and run:

```tsx
import { runtime } from "native-signal-ui";          // (drop this if you're using jsxInject)
import { NativeSignal } from "native-signal/weak";

const count = new NativeSignal(0);

document.body.append(
    <button onclick={() => count.set(count.get() + 1)}>
        count is {count}
    </button>,
);
```

```bash
npx tsc --noEmit   # no errors
npx vite           # runs
```

---

## Quick start

```tsx
import { runtime } from "native-signal-ui";
import { If, ForKeyed, bind } from "native-signal-ui";
import { NativeSignal, Computed } from "native-signal/weak";

const name  = new NativeSignal("world");
const todos = new NativeSignal<{ id: number; text: string }[]>([]);

const app = (
    <div class="app">
        <input value={name} oninput={(e: any) => name.set(e.target.value)} />
        <h1>Hello, {name}!</h1>

        {If(new Computed(() => todos.get().length === 0), <p>No todos yet.</p>)}

        <ul>
            {ForKeyed("id", todos, (t) => <li>{t.text}</li>)}
        </ul>
    </div>
);

document.body.append(app);

todos.set([{id:0, test: "New Todo!"}]);
```

---

## Reactivity in JSX

The unit of reactivity is usually  a `NativeSignal` or `Computed` from `native-signal`. 
The runtime detects these automatically wherever you use them. But it also supports 
Promises, literal values, arrays, component classes (anything with a to_html method).

### Reactive children

Pass a signal anywhere a child goes. The runtime mounts it between comment
anchors and updates that slice of DOM in place when it changes:

```tsx
const label = new Computed(() => `${user.get().first} ${user.get().last}`);

<span>Signed in as {label}</span>;
```

Children can also be: plain strings/numbers, DOM nodes, arrays of children,
`Promise<Child>` (mounts a placeholder, swaps in the resolved value once), and
any object exposing `to_html()` (which is how the control-flow helpers and
`Component`s plug in).

### Reactive attributes

Any attribute value that is a signal is bound reactively:

```tsx
const disabled = new NativeSignal(false);

<button disabled={disabled}>Save</button>;
```

Plain (non-signal) values are set once and never tracked. Falsy boolean/`null`
values remove the attribute; `true` sets it as a boolean attribute.

### `style:` and `class:` namespaced attributes

For precise, per-property control there are namespaced attribute keys. These are
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

### Events

`on*` props whose value is a function are attached with `addEventListener`
(the event name is the lowercased remainder, so `onclick` → `"click"`):

```tsx
<button onclick={(e) => console.log(e)}>Click</button>;
```

---

## Control flow

These helpers return a `DocumentFragment` (or a `{ to_html() }` object) that you
drop straight into JSX. They manage their own anchor-delimited slot and cache
materialised branches, so inner state and signals survive show/hide toggles.

### `If`

```ts
If(condition, content, inverse?)
```

`condition` may be a signal, a `Computed`, or a plain `() => boolean` (wrapped in
a `Computed` for you). `content` may be a value, an array, or a **factory
function** that is called at most once, lazily, the first time the branch
becomes visible.

```tsx
{If(loggedIn, <Dashboard />)}
{If(loggedIn, <LoginForm />, /* inverse */ true)}
{If(() => count.get() > 10, () => <ExpensiveThing />)}   // lazy
```

### `AB`

Switch between two branches on a boolean. The inactive branch is held in a
detached fragment (state preserved), not destroyed.

```tsx
{AB(loggedIn,
    <Dashboard />,     // truthy branch
    <LoginForm />)}    // falsy branch
```

### `Switch`

Map a signal's value to one of several branches:

```tsx
{Switch(route, {
    home:    () => <Home />,
    about:   () => <About />,
    contact: <Contact />,
})}
```

Each branch is materialised at most once and cached; an unmatched value renders
nothing.

### `ForKeyed`

A **keyed** list. The mapper runs exactly once per unique key, and that node is
reused for the key's lifetime even when the item moves. The `Computed` only
drives structure (insert / remove / reorder) — reactivity *within* an item is
the mapper's responsibility.

```ts
ForKeyed(key, generator, mapper)
```

```tsx
{ForKeyed(
    "id",
    todos,                              // signal or () => T[]
    (todo) => <li>{todo.text}</li>,
)}
```

---

## Two-way form binding

`bind` wires a form element to a `NativeSignal` in both directions and returns an
unsubscribe function. It infers the right event and coercion from the element
type (checkbox → boolean, number/range → number, multi-select → string[], else
string):

```tsx
import { bind } from "native-signal-ui";

const text = new NativeSignal("");
const el   = <input /> as HTMLInputElement;
const unbind = bind(el, text);            // bind(el, signal, { event, coerce })
```

There are also one-call factories that build the element and bind it:

```ts
const [input,    cleanup] = boundInput("number", ageSignal, { placeholder: "Age" });
const [select,   cleanup] = boundSelect([{ value: "eq", label: "=" }], opSignal);
const [textarea, cleanup] = boundTextarea(bodySignal);
```

---

## Components

`Component` is a tiny abstract base. A component is just an object that owns a
root element and knows how to render it via `to_html()`. In JSX, a class that
extends `Component` is instantiated with `{ ...props, content: children }`:

```tsx
import { Component } from "native-signal-ui";

class Card extends Component<HTMLDivElement> {
    root: HTMLDivElement;

    constructor(props: { title: string; content?: any }) {
        super();
        this.root = (
            <div class="card">
                <h2>{props.title}</h2>
                <div class="body">{props.content}</div>
            </div>
        ) as HTMLDivElement;
    }
}

const view = <Card title="Hello">some children</Card>;
```

`destroy()` removes the root from the DOM.

---

## `own(value, ...owners)`

`native-signal` retains subscribers via `WeakRef`. If your subscriber closure
isn't kept alive by anything else, GC will eventually collect it and the signal
will silently stop notifying. `own()` ties a value's lifetime to one or more
owner objects (without modifying them) so you don't have to invent a field on
every component just to hold onto a closure:

```ts
import { own } from "native-signal-ui";

const fn = (_src, next) => { /* ... */ };
signal.subscribe(fn);
own(fn, root); // fn stays alive at least as long as `root` does
```

The control-flow helpers and attribute bindings use `own` internally to anchor
their `Computed`s to the DOM nodes they drive, so those effects live exactly as
long as their nodes do. You only need `own` for subscriptions you create
yourself. It is not free — prefer a direct object reference when performance
matters.

---

## API reference

All exports come from `native-signal-ui` (reactivity primitives come from
`native-signal/weak`):

| Export        | Kind                | Purpose                                            |
| ------------- | ------------------- | -------------------------------------------------- |
| `runtime`     | namespace           | `runtime.h` / `runtime.Fragment` JSX factory       |
| `If`          | function            | Conditional rendering                              |
| `AB`          | function            | Two-branch toggle                                  |
| `Switch`      | function            | Multi-branch by signal value                       |
| `ForKeyed`    | function            | Keyed list rendering                               |
| `bind`        | function            | Two-way form ↔ signal binding                      |
| `boundInput` / `boundSelect` / `boundTextarea` | functions | Build + bind a form element in one call |
| `bind_attrs`  | function            | Imperatively bind a record of attrs to an element  |
| `own`         | function            | Keep a value alive as long as its owners exist     |
| `Component`   | abstract class      | Base class for components                          |

---

## Scripts

- `npm run build` — produce the ESM bundle + `.d.ts` files in `dist/`
- `npm run dev` — Vite dev server
- `npm test` — run the vitest suite
- `npm run typecheck` — `tsc --noEmit`

---

## License

UNLICENSED for now — set this before publishing.
