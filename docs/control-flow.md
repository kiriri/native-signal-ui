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

## `ForCollection`

Renders a `KeyedCollection` from `native-signal/weak` (`MapCollection`,
`RecordCollection`, `MappedCollection`, …). Nothing is diffed: the list is a
`KeyedCollectionConsumer`, so an update visits **only the entries that
changed** — O(changes), not O(size). Prefer it over `ForKeyed` whenever the
data already lives in a keyed collection.

```ts
ForCollection(collection, (value, key) => Child)
```

```tsx
const todos = new MapCollection<string, Todo>();

{ForCollection(todos, (todo, id) => <li>{todo.text}</li>)}
```

- **added** entry → `mapper(value, key)` runs once, nodes appended at the end
- **value replaced** (`set(key, other)`) → `mapper` runs again; the new nodes
  replace the old ones in place. To keep an item's DOM stable, store an object /
  signal and react to it inside the mapper instead of replacing the value.
- **deleted** entry → its nodes are removed (also nested control flow inside it)
- Setting a key back to the value already rendered within one tick, or adding and
  deleting it within one tick, is a no-op. `ref(key)` placeholders render nothing.
- **Order** is the order entries became present; a key deleted and re-added moves
  to the end. There is no sorting.
- Signal reads inside the mapper are not tracked by the list.

Requires `native-signal` ≥ 0.6.2 (keyed collections).

---

Next: [Components](./components.md) · [Reactivity](./reactivity.md) ·
[API reference](./api.md)
