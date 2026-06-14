// bind.ts
//
// Two-way binding helper between native form elements and NativeSignals.
// Works for: input (text, number, date, datetime-local, month, checkbox, radio),
//            select (single & multiple), textarea, and any custom element that
//            fires an "input" or "change" event and exposes a .value property.
//
// Usage:
//   bind(inputEl, signal)
//   bind(inputEl, signal, { event: "change" })
//
// Returns an unsubscribe function.

import { NativeSignal } from "native-signal/weak";
import { own } from "./own";

export interface BindOptions {
    /**
     * Which DOM event to listen to.
     * Defaults to "input" for text-like elements, "change" for select/checkbox/radio.
     * Override explicitly if needed.
     */
    event?: "input" | "change";

    /**
     * Value coercion to apply when reading from the DOM element.
     * Defaults are inferred from element type:
     *   checkbox        → boolean
     *   number / range  → number
     *   select[multiple]→ string[]
     *   everything else → string
     */
    coerce?: "string" | "number" | "boolean" | "array";
}

type BindableElement =
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;

/**
 * Bind a form element to a NativeSignal bidirectionally.
 *
 * - DOM → Signal: listens for the appropriate event and updates the signal.
 * - Signal → DOM: subscribes to the signal and updates the element value.
 *
 * @returns An unsubscribe function to unbind signal and element.
 */
export function bind<T>(
    el: BindableElement,
    signal: NativeSignal<T>,
    opts: BindOptions = {},
): () => void {
    const coerce = opts.coerce ?? inferCoerce(el);
    const event  = opts.event  ?? inferEvent(el);

    // ── Signal → DOM ────────────────────────────────────────────────────────
    // Write initial value immediately, then subscribe for future changes.
    const writeToEl = (value: T) => {
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
            el.checked = Boolean(value);
        } else if (el instanceof HTMLSelectElement && el.multiple) {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            for (const opt of el.options) {
                opt.selected = arr.includes(opt.value);
            }
        } else {
            const str = value === null || value === undefined ? "" : String(value);
            if (el.value !== str) el.value = str;
        }
    };

    writeToEl(signal.get());

    const fn = (_src:typeof signal, value: any) => writeToEl(value);
    signal.subscribe(fn);

    // ── DOM → Signal ────────────────────────────────────────────────────────
    const readFromEl = (): T => {
        if (coerce === "boolean") {
            return Boolean((el as HTMLInputElement).checked) as unknown as T;
        }
        if (coerce === "number") {
            return Number(el.value) as unknown as T;
        }
        if (coerce === "array" && el instanceof HTMLSelectElement) {
            return Array.from(el.selectedOptions).map(o => o.value) as unknown as T;
        }
        return el.value as unknown as T;
    };

    const handler = () => {
        const next = readFromEl();
        // Avoid redundant sets (helps prevent cursor-position resets in text inputs)
        if (next !== signal.get()) {
            signal.set(next);
        }
    };

    el.addEventListener(event, handler);
    own(fn, el);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
        el.removeEventListener(event, handler);
    };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function inferCoerce(el: BindableElement): BindOptions["coerce"] {
    if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox" || el.type === "radio") return "boolean";
        if (el.type === "number" || el.type === "range") return "number";
    }
    if (el instanceof HTMLSelectElement && el.multiple) return "array";
    return "string";
}

function inferEvent(el: BindableElement): "input" | "change" {
    if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox" || el.type === "radio") return "change";
    }
    if (el instanceof HTMLSelectElement) return "change";
    return "input";
}

// ── Convenience factory ──────────────────────────────────────────────────────

/**
 * Create a bound input element in one call.
 *
 * @example
 * const [input, cleanup] = boundInput("text", mySignal, { placeholder: "Search…" });
 * root.appendChild(input);
 */
export function boundInput<T>(
    type: HTMLInputElement["type"],
    signal: NativeSignal<T>,
    attrs: Record<string, string> = {},
    opts: BindOptions = {},
): [HTMLInputElement, () => void] {
    const el = document.createElement("input");
    el.type = type;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const cleanup = bind(el, signal, opts);
    return [el, cleanup];
}

/**
 * Create a bound <select> element.
 *
 * @example
 * const [sel, cleanup] = boundSelect(
 *   [{ value: "eq", label: "=" }, { value: "ne", label: "≠" }],
 *   operatorSignal,
 * );
 */
export function boundSelect<T extends string>(
    options: { value: T; label: string }[],
    signal: NativeSignal<T>,
    attrs: Record<string, string> = {},
): [HTMLSelectElement, () => void] {
    const el = document.createElement("select");
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const opt of options) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        el.appendChild(o);
    }
    const cleanup = bind(el, signal);
    return [el, cleanup];
}

/**
 * Create a bound <textarea>.
 */
export function boundTextarea(
    signal: NativeSignal<string>,
    attrs: Record<string, string> = {},
): [HTMLTextAreaElement, () => void] {
    const el = document.createElement("textarea");
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const cleanup = bind(el, signal);
    return [el, cleanup];
}