# AGENTS.md — native-signal-ui

Agent-facing index for **native-signal-ui**, a minimal signal-based UI library:
no virtual DOM, no diffing, no component re-renders. JSX evaluates to **real DOM
nodes**; individual signals wire themselves directly to the attributes and text
nodes that depend on them. When a signal changes, only the exact DOM that reads
it updates.

This file is for AI agents. End users: see [README.md](./README.md).

## Hard invariants (read before writing code)

- **JSX is the *classic* transform**, not React's automatic runtime. Factory is
  `runtime.h` / `runtime.Fragment`. `tsconfig` + bundler must be wired for it.
  → [docs/setup.md](./docs/setup.md)
- **Reactivity primitives come from `native-signal/weak`** (`NativeSignal`,
  `Computed`), *not* from this package. This package is only the DOM-binding
  layer. `native-signal` is a runtime dependency and is **external** to the build
  (never bundled).
- **A JSX expression is a live DOM node.** There is no render loop. Building the
  node runs once; signals update sub-parts in place. Don't reach for re-render
  patterns.
- **WeakRef GC trap:** subscribers are held via `WeakRef`. A subscription you
  create yourself can be silently collected — anchor it with `own(fn, owner)`.
  Built-in bindings/control-flow already use `own` internally.
  → [docs/pitfalls.md](./docs/pitfalls.md)

## Usage docs (link map)

- [Setup (Vite + TS, JSX factory, global JSX types)](./docs/setup.md)
- [Reactivity in JSX (children, attrs, `style:`/`class:`, events, `bind`)](./docs/reactivity.md)
- [Control flow (`If` / `AB` / `Switch` / `ForKeyed`)](./docs/control-flow.md)
- [Components (`Component`, `to_html`, props/children, `destroy`)](./docs/components.md)
- [Pitfalls & gotchas (`own` / GC, classic JSX, externals)](./docs/pitfalls.md)
- [API reference](./docs/api.md)