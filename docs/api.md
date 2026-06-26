# API reference

All exports come from `native-signal-ui`. Reactivity primitives
(`NativeSignal`, `Computed`) come from `native-signal/weak`.

| Export        | Kind                | Purpose                                            |
| ------------- | ------------------- | -------------------------------------------------- |
| `runtime`     | namespace           | `runtime.h` / `runtime.Fragment` JSX factory       |
| `If`          | function            | Conditional rendering                              |
| `AB`          | function            | Two-branch toggle                                  |
| `Switch`      | function            | Multi-branch by signal value                       |
| `ForKeyed`    | function            | Keyed list rendering                               |
| `bind`        | function            | Two-way form ↔ signal binding                      |
| `boundInput` / `boundSelect` / `boundTextarea` | functions | Build + bind a form element in one call |
| `bind_attrs`  | function            | Imperatively bind a record of attrs to an element  |
| `own`         | function            | Keep a value alive as long as its owners exist     |
| `Component`   | abstract class      | Base class for components                          |

Topic guides: [Setup](./setup.md) · [Reactivity](./reactivity.md) ·
[Control flow](./control-flow.md) · [Components](./components.md) ·
[Pitfalls](./pitfalls.md)
