# Setup (Vite + TypeScript)

`native-signal-ui` uses the **classic** JSX transform — a custom factory
(`runtime.h` / `runtime.Fragment`), **not** the React 17+ automatic runtime. You
must tell *both* TypeScript and the bundler (esbuild/Vite) about the factory, and
make the global `JSX` namespace visible to `tsc`.

## 1. Install

```bash
npm install native-signal-ui
```

## 2. Point the JSX factory at the runtime

The factory functions are exported under the `runtime` namespace (`runtime.h`,
`runtime.Fragment`). esbuild reads these compiler options out of `tsconfig.json`,
so configuring them here covers both type checking *and* the build.

**`tsconfig.json`**

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

To avoid importing `runtime` in every `.tsx` file, inject it via the bundler.
**`vite.config.ts`**:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    jsxFactory: "h",
    jsxFragment: "Fragment",
    // injected into every JSX module so `runtime` is always in scope
    jsxInject: `import { runtime } from "native-signal-ui"; const {h, Fragment} = runtime;`,
  },
});
```

## 3. Make `tsc` aware of the global JSX types

This package augments the **global `JSX` namespace** (so `JSX.IntrinsicElements`,
`JSX.Element`, `style:*` / `class:*` attribute typing all exist). That
augmentation is activated by *importing* the package's types. If `tsc` complains
that *"JSX element implicitly has type 'any' because no interface
'JSX.IntrinsicElements' exists"*, the global types were never loaded.

Add a single ambient declaration file covered by your `include` — e.g.
**`src/signal-ui.d.ts`**:

```ts
import "native-signal-ui";
export {};
```

## 4. Sanity check

A minimal `src/main.tsx` that should type-check and run:

```tsx
import { runtime } from "native-signal-ui";          // drop this if using jsxInject
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

Next: [Reactivity in JSX](./reactivity.md) · [Control flow](./control-flow.md) ·
[Components](./components.md) · [Pitfalls](./pitfalls.md)
