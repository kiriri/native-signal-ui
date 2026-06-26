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

## Keeping subscriptions alive

If a component sets up its own `signal.subscribe(...)` (rather than binding a
signal directly in JSX), the closure can be garbage-collected because
`native-signal` retains subscribers via `WeakRef`. Anchor it with `own()` — see
[Pitfalls](./pitfalls.md).

---

Next: [Reactivity](./reactivity.md) · [Control flow](./control-flow.md) ·
[Pitfalls (`own` / GC)](./pitfalls.md) · [API reference](./api.md)
