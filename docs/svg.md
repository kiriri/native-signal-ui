# SVG

SVG works in JSX like HTML does: tags become real `SVGElement`s, and signals
bind to their attributes and children.

```tsx
const x = new NativeSignal(20);

const chart = <svg viewBox="0 0 100 50" width={200}>
    <circle cx={x} cy={25} r={10} fill="steelblue" stroke-width={2} onclick={() => x.set(x.get() + 10)} />
    <text x={4} y={46} font-size={8}>x = {x}</text>
</svg>;
```

## Namespace is picked by tag name

JSX is evaluated **bottom-up**: children are built before their parent. So
`<circle>` can't look up whether it sits inside an `<svg>`. The runtime picks
the namespace from the tag name instead:

- **SVG-only tags** (`svg`, `g`, `circle`, `path`, `linearGradient`,
  `foreignObject`, `feGaussianBlur`, …) are always created as SVG, wherever
  they appear. camelCase names are kept as written.
- **`a`, `script`, `style`, `title`** exist in both HTML and SVG, so they
  **default to HTML**. Add the `svg:` prefix to get the SVG element:

```tsx
<svg>
    <svg:a href="/details">
        <circle r={4} />
        <svg:title>Hover tooltip</svg:title>
    </svg:a>
</svg>
```

  Without the prefix you get an HTML `<a>`/`<title>` inside the `<svg>`. The
  browser doesn't render it, and nothing reports an error. Any SVG tag accepts
  the prefix (`<svg:circle>` is the same as `<circle>`).
- **Everything else is HTML**, including children of `<foreignObject>`.

## Attributes are set verbatim

On SVG elements every prop except events, `class`/`className` and `style` is
written with `setAttribute` under its exact name. That's because SVG DOM
properties (`cx`, `width`, `viewBox`, …) are read-only `SVGAnimated*` objects.
So write real attribute names: `stroke-width`, `viewBox`, `text-anchor`.
React's `strokeWidth` won't work.

- `false` / `null` / `undefined` remove the attribute, and `true` sets it to `""`.
- `class` and `className` both set the `class` attribute.
- `class:foo`, `style:prop` and whole-`style` work the same as on HTML (see
  [Reactivity](./reactivity.md)).
- `xlink:href` and `xml:*` are set with their XML namespaces. Plain `href`
  works in all current browsers and is preferred.
- Any value can be a signal.

## Types

All SVG tags are in `JSX.IntrinsicElements` (plus `svg:`-prefixed variants).
Common attributes autocomplete and are typed as
`string | number | null | undefined`, or a signal of those. Any other
attribute still passes through the catch-all.

---

Back to: [Reactivity](./reactivity.md) · [Pitfalls](./pitfalls.md) ·
[API reference](./api.md)
