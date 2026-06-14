import { Computed } from "native-signal/weak";
import { own } from "./own";



/**
 * Bind a record of signals (or plain values) to an element's attributes reactively.
 * Each key maps to an attribute name; each value may be a signal, a Computed,
 * or a raw value. Signal values are unwrapped and kept live with a Computed effect.
 *
 * @example
 * bindAttrs(btn, {
 *   disabled: this.is_readonly,          // NativeSignal<boolean>
 *   "aria-pressed": this.show_versions,  // NativeSignal<boolean>
 *   class: new Computed(() =>            // Computed<string>
 *       `version-item ${active.get() === v.id ? "active" : ""}`),
 *   ["class.open"]:this.is_open,         // NativeSignal<boolean> 
 *   value: "static-value",              // plain string — set once, not tracked
 * });
 */
type SignalLike<T> = { get(): T };
export type AttrValue = SignalLike<string | boolean | number | null> | string | boolean | number | null;

export function bind_attrs(
    el: Element,
    attrs: Record<string, AttrValue>,

)
{

    for (const [key, value] of Object.entries(attrs))
    {
        const isSignal = value !== null
            && typeof value === "object"
            && typeof (value as any).get === "function";

        // ── class.foo mode ───────────────────────────────────────────────────
        if (key.startsWith("class."))
        {
            const className = key.slice("class.".length);

            const apply = (v: unknown) =>
            {
                el.classList.toggle(className, Boolean(v));
            }

            if (isSignal)
            {
                const sig = value as SignalLike<any>;
                let effect = new Computed(() => apply(sig.get()), undefined, true);
                own(effect, el);
            }
            else
                apply(value);

            continue;
        }

        // ── normal attribute mode ────────────────────────────────────────────
        const apply = (v: string | boolean | number | null) =>
        {
            if (v === false || v === null || v === undefined)
                el.removeAttribute(key);
            else if (v === true)
                el.setAttribute(key, "");
            else
                el.setAttribute(key, String(v));
        };

        if (isSignal)
        {
            const sig = value as SignalLike<any>;
            let effect = new Computed(() => apply(sig.get()), undefined, true);
            own(effect, el);

        }
        else
            apply(value as any);
    }

}
