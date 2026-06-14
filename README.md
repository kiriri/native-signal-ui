# signal-ui

A minimal, signal-based UI framework built around tagged template literals.
No virtual DOM, no JSX, no compiler — just `html\`\`` and `css\`\``.

## Install

```bash
npm install native-signal-ui
```

## Quick start



## `own(value, ...owners)`

`native-signal` retains subscribers via `WeakRef`. If your subscriber closure
isn't kept alive by anything else, GC will eventually collect it and the
signal will silently stop notifying. `own()` ties a value's lifetime to one or
more owner objects (without modifying them) so you don't have to invent a
field on every component just to hold onto a closure:

```ts
import { own } from "native-signal-ui";

const fn = (_, next) => { /* ... */ };
signal.subscribe(fn);
own(fn, root); // fn stays alive at least as long as root does
```

## Scripts

- `npm run build` — produce ESM bundle + `.d.ts` files in `dist/`
- `npm test` — run the vitest suite
- `npm run typecheck` — `tsc --noEmit`

## License

UNLICENSED for now — set this when publishing.
