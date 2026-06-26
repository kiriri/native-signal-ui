# Control flow

These helpers return a `DocumentFragment` (or a `{ to_html() }` object) that you
drop straight into JSX. They manage their own anchor-delimited slot and cache
materialised branches, so inner state and signals survive show/hide toggles.

## `If`

```ts
If(condition, content, inverse?)
```

`condition` may be a signal, a `Computed`, or a plain `() => boolean` (wrapped in
a `Computed` for you). `content` may be a value, an array, or a **factory
function** called at most once, lazily, the first time the branch becomes
visible.

```tsx
{If(loggedIn, <Dashboard />)}
{If(loggedIn, <LoginForm />, /* inverse */ true)}
{If(() => count.get() > 10, () => <ExpensiveThing />)}   // lazy
```

## `AB`

Switch between two branches on a boolean. The inactive branch is held in a
detached fragment (state preserved), not destroyed.

```tsx
{AB(loggedIn,
    <Dashboard />,     // truthy branch
    <LoginForm />)}    // falsy branch
```

## `Switch`

Map a signal's value to one of several branches. Each branch is materialised at
most once and cached; an unmatched value renders nothing.

```tsx
{Switch(route, {
    home:    () => <Home />,
    about:   () => <About />,
    contact: <Contact />,
})}
```

## `ForKeyed`

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

Next: [Components](./components.md) · [Reactivity](./reactivity.md) ·
[API reference](./api.md)
