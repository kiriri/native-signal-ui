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

## Documentation

Topic guides live in [`docs/`](./docs) (and ship with the npm package, so an
agent working in a downstream project can read them from
`node_modules/native-signal-ui/`):

- **[Setup](./docs/setup.md)** — Vite + TypeScript, the classic JSX factory, and
  making the global `JSX` types visible. *This is the part that trips people up.*
- **[Reactivity in JSX](./docs/reactivity.md)** — reactive children & attributes,
  `style:` / `class:` namespaced attrs, events, and two-way form `bind`.
- **[Control flow](./docs/control-flow.md)** — `If`, `AB`, `Switch`, `ForKeyed`.
- **[Components](./docs/components.md)** — the `Component` base class.
- **[Pitfalls](./docs/pitfalls.md)** — `own()` / WeakRef GC, classic vs. automatic
  JSX, `native-signal` as an external.
- **[API reference](./docs/api.md)** — the full export table.

Working with an AI agent? Point it at **[AGENTS.md](./AGENTS.md)** (also
`CLAUDE.md`) — a terse index of the hard invariants plus links into the docs
above.

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

## Quick start

> Reactivity primitives come from `native-signal/weak`. JSX uses the **classic**
> transform (`runtime.h` / `runtime.Fragment`) — see [Setup](./docs/setup.md)
> before your first build.

```tsx
import { runtime } from "native-signal-ui";
import { If, ForKeyed } from "native-signal-ui";
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

todos.set([{ id: 0, text: "New Todo!" }]);
```

---

## Scripts

- `npm run build` — produce the ESM bundle + `.d.ts` files in `dist/`
- `npm run dev` — Vite dev server
- `npm test` — run the vitest suite
- `npm run typecheck` — `tsc --noEmit`

---

## License

UNLICENSED for now — set this before publishing.
