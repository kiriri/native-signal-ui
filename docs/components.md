# Components

`Component` is a tiny abstract base. A component is just an object that owns a
root element and knows how to render it via `to_html()`. In JSX, a class that
extends `Component` is instantiated with `{ ...props, content: children }` — so
children arrive as a `content` prop.

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

- The `root` field holds the live element; `to_html()` (provided by the base)
  returns it for mounting.
- `destroy()` removes the root from the DOM.
- Reactivity inside a component works exactly as anywhere else — bind signals
  directly in the JSX. See [Reactivity in JSX](./reactivity.md). There is **no**
  re-render: the constructor builds the DOM once and signals update it in place.

## Function components

A plain function works as a tag too. It is **called**, not constructed, with
its props; children arrive as both `content` and `children` (one child as
itself, several as an array), so a function and a class are interchangeable at
the call site.

```tsx
function Pill({ label, content }: { label: string; content?: any }) {
    return <span class="pill"><b>{label}</b> {content}</span>;
}

const view = <Pill label="Status">open</Pill>;
```

It may return anything a JSX child can be: a node or a `Component` comes back
as-is, anything else (an array, a signal, a string, a promise) is wrapped in a
`DocumentFragment`. Like a class, it runs once; bind signals for anything that
changes.

## Keeping subscriptions alive

If a component sets up its own `signal.subscribe(...)` (rather than binding a
signal directly in JSX), the closure can be garbage-collected because
`native-signal` retains subscribers via `WeakRef`. Anchor it with `own()` — see
[Pitfalls](./pitfalls.md).

---

Next: [Reactivity](./reactivity.md) · [Control flow](./control-flow.md) ·
[Pitfalls (`own` / GC)](./pitfalls.md) · [API reference](./api.md)
