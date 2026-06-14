import { Computed, NativeSignal } from "native-signal/weak";
import { materialise, swap_slot, type Child } from "./jsx-runtime";
import { own } from "./own";

type Reactive<T = unknown> = NativeSignal<T> | Computed<T>;
type LazyChild = Child | Child[] | (() => Child | Child[]);

/**
 * Switches between two content branches based on a boolean signal/computed.
 * Branches are materialised at most once, on first activation, and cached
 * for all subsequent renders. Inactive nodes are held in a detached fragment
 * so inner signals and state are preserved.
 *
 * `truthy_content` and `falsy_content` may each be a factory function:
 * each is called at most once, the first time its branch becomes active.
 */
export function AB(
    signal: Reactive<any> | NativeSignal<any>,
    truthy_content: LazyChild,
    falsy_content: LazyChild,
): DocumentFragment
{
    const frag = document.createDocumentFragment();
    const start = document.createComment("[ab");
    const end = document.createComment("ab]");
    frag.appendChild(start);
    frag.appendChild(end);

    let truthy_nodes: ReturnType<typeof materialise> | null = null;
    let falsy_nodes: ReturnType<typeof materialise> | null = null;
    const holding = document.createDocumentFragment();

    let current_state: boolean | null = null;

    const effect = new Computed(() =>
    {
        const show_truthy = !!signal.get();
        if (show_truthy === current_state) return;
        current_state = show_truthy;

        if (show_truthy)
        {
            if (truthy_nodes === null) {
                const resolved = typeof truthy_content === "function" ? truthy_content() : truthy_content;
                truthy_nodes = materialise(resolved, start);
            }
            if (falsy_nodes !== null) {
                for (const n of falsy_nodes) holding.appendChild(n);
            }
            swap_slot(start, end, truthy_nodes);
        } else
        {
            if (falsy_nodes === null) {
                const resolved = typeof falsy_content === "function" ? falsy_content() : falsy_content;
                falsy_nodes = materialise(resolved, start);
            }
            if (truthy_nodes !== null) {
                for (const n of truthy_nodes) holding.appendChild(n);
            }
            swap_slot(start, end, falsy_nodes);
        }
    }, undefined, true);

    own(effect, start);

    return frag;
}

export function Switch<T extends string | number | symbol>(
    signal: Reactive<T> | NativeSignal<T>,
    cases: Record<T, LazyChild>,
): DocumentFragment
{
    const frag = document.createDocumentFragment();
    const start = document.createComment("[switch");
    const end = document.createComment("switch]");
    frag.appendChild(start);
    frag.appendChild(end);

    const nodes = {} as Record<T, ReturnType<typeof materialise>>;
    const holding = document.createDocumentFragment();

    let current_state: T | null = null;

    const effect = new Computed(() =>
    {
        const key = signal.get();
        if (key === current_state) return;

        // detach the currently-active branch (if any)
        if (current_state !== null && nodes[current_state] != null) {
            for (const n of nodes[current_state]) holding.appendChild(n);
        }

        current_state = key;

        const content = cases[key];
        if (content === undefined) {
            // no matching case: leave slot empty
            swap_slot(start, end, []);
            return;
        }

        if (nodes[key] == null) {
            const resolved: Child | Child[] = (typeof content === "function") ? content() : content;

            nodes[key] = materialise(resolved, start);
        }

        swap_slot(start, end, nodes[key]);
    }, undefined, true);

    own(effect, start);

    return frag;
}