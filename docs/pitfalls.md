# Pitfalls & gotchas

## Classic JSX transform, not the automatic runtime

This library uses `jsxFactory: "runtime.h"` / `jsxFragmentFactory:
"runtime.Fragment"` — **not** React 17+'s automatic runtime. If you see
"Cannot find name 'runtime'" or JSX compiling to `_jsx(...)`, your `tsconfig` /
bundler is misconfigured. See [Setup](./setup.md).

## `<title>` / `<a>` inside `<svg>` need the `svg:` prefix

`a`, `script`, `style` and `title` exist in HTML and SVG. JSX builds children
before parents, so the runtime can't see the enclosing `<svg>`, and these four
tags default to HTML. An HTML `<title>` inside an `<svg>` silently does nothing.
Write `<svg:title>`, `<svg:a>`. See [SVG](./svg.md).

## `own(value, ...owners)` — the WeakRef trap

`native-signal/weak` retains subscribers via `WeakRef`. If your subscriber closure
isn't kept alive by anything else, GC will eventually collect it and the signal
will **silently stop notifying**. `own()` ties a value's lifetime to one or more
owner objects (without modifying them):

```ts
import { own } from "native-signal-ui";

const fn = (_src, next) => { /* ... */ };
signal.subscribe(fn);
own(fn, root); // fn stays alive at least as long as `root` does

// one-liner:
signal.subscribe(own((_src, next) => { /* ... */ }, root));
```

The control-flow helpers and attribute bindings use `own` internally to anchor
their `Computed`s to the DOM nodes they drive, so those effects live exactly as
long as their nodes do. **You only need `own` for subscriptions you create
yourself.**

## `ForKeyed` only drives structure

The `ForKeyed` `Computed` triggers insert / remove / reorder. Reactivity
*within* an item (e.g. an editable field) is the mapper's responsibility — bind
signals inside the mapped node. See [Control flow](./control-flow.md).

## `class:` must come *after* a plain `class` attribute

Attribute props apply in source (object key) order. A plain `class="..."`
assignment sets `className` wholesale; a `class:foo={...}` binding only
toggles that one token. If `class:foo` appears *before* `class` in the JSX,
the plain assignment runs second and wipes out the toggle:

```tsx
// BUG: "active" gets set, then immediately erased by class="row"
<div class:active={isActive} class="row" />

// correct: plain class first, then the namespaced toggle
<div class="row" class:active={isActive} />
```

With a **reactive** `isActive` (a `Computed`/`NativeSignal`), this only
corrupts the *initial* render — the class re-appears correctly the next time
the signal changes, since `classList.toggle` only touches its own token and
no longer competes with a later `class=` write. With a **plain** boolean,
there's no subsequent reactive update to self-heal it, so the class is lost
for good. This is especially easy to hit in a list row that's fully rebuilt
from scratch on every change (rather than diffed in place): every rebuild
re-triggers the same ordering bug, so the "active" row never highlights.

## Inadvertent constructor time signal bindings

When you create parts of the dom inside a Computed, make sure to use `detached` from 
`native-signal/weak` to avoid the Computed from rerunning any time any hidden signal 
inside a child component updates a signal it accessed via `get()` in its constructor.

---

Back to: [Reactivity](./reactivity.md) · [Components](./components.md) ·
[API reference](./api.md)
