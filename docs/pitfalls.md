# Pitfalls & gotchas

## Classic JSX transform, not the automatic runtime

This library uses `jsxFactory: "runtime.h"` / `jsxFragmentFactory:
"runtime.Fragment"` — **not** React 17+'s automatic runtime. If you see
"Cannot find name 'runtime'" or JSX compiling to `_jsx(...)`, your `tsconfig` /
bundler is misconfigured. See [Setup](./setup.md).

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

## Inadvertent constructor time signal bindings

When you create parts of the dom inside a Computed, make sure to use `detached` from 
`native-signal/weak` to avoid the Computed from rerunning any time any hidden signal 
inside a child component updates a signal it accessed via `get()` in its constructor.

---

Back to: [Reactivity](./reactivity.md) · [Components](./components.md) ·
[API reference](./api.md)
