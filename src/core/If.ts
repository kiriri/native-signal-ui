import { Computed, NativeSignal } from "native-signal/weak";
import { materialise, swap_slot, type Child } from "./jsx-runtime";
import { own } from "./own";

type Reactive<T = unknown> = NativeSignal<T> | Computed<T>;
type LazyChild = Child | Child[] | (() => Child | Child[]);

/**
 * Conditionally renders content between two anchor comments.
 * When falsy, the slot is simply empty — no placeholder node needed.
 *
 * `content` may be a factory function: it is called at most once, the first
 * time the condition is truthy, and its result is cached for all subsequent
 * renders.
 */
export function If(
    signal: Reactive<any> | NativeSignal<any> | (()=>boolean),
    content: LazyChild,
    inverse:boolean = false
): DocumentFragment {
    if(typeof signal === "function")
        signal = new Computed(signal);

    const frag  = document.createDocumentFragment();
    const start = document.createComment("[if");
    const end   = document.createComment("if]");
    frag.appendChild(start);
    frag.appendChild(end);

    let content_nodes: ReturnType<typeof materialise> | null = null;
    let current_state: boolean | null = null;

    const effect = new Computed(() => {
        const show = inverse ? !signal.get() : !!signal.get();
        if (show === current_state) return;
        current_state = show;

        if (show) {
            if (content_nodes === null) {
                const resolved = typeof content === "function" ? content() : content;
                content_nodes = materialise(resolved, start);
            }
            swap_slot(start, end, content_nodes);
        } else {
            swap_slot(start, end, []);
        }
    }, undefined, true);

    own(effect, start);

    return frag;
}