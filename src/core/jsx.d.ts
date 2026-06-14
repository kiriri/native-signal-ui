declare namespace JSX
{
    // Fix: the old `type Element = Element | ...` was a circular self-reference.
    // Refer to the real DOM types via globalThis.
    type Element =
        | globalThis.Element
        | HTMLElement
        | DocumentFragment
        | Text
        | Comment;

    type StatefulSubscribable<T> = { get(): T };
    type MaybeSignal<T> = T | StatefulSubscribable<T>;
    type SignalCompatible<T> = {
        [K in keyof T]: T[K] extends object
            ? MaybeSignal<T[K]> | SignalCompatible<T[K]>
            : MaybeSignal<T[K]>;
    };

    /* ──────────────────────────────────────────────────────────────────────
     * Namespaced attribute syntax
     *
     *   style:color={signal}     → value typed as MaybeSignal<CSSStyleDeclaration["color"]>
     *   style:fontWeight="bold"  → value typed from the matching CSS property
     *   class:active={signal}    → value typed as MaybeSignal<boolean> (toggle)
     *
     * These are concrete template-literal keys, so they take priority over the
     * `[propName: string]: any` catch-all below — that's what gives you real
     * field-type checking instead of `any`.
     * ────────────────────────────────────────────────────────────────────── */
    type StyleNamespace = {
        [K in keyof CSSStyleDeclaration as `style:${string & K}`]?:
            MaybeSignal<CSSStyleDeclaration[K]>;
    };

    type ClassNamespace = {
        // class:foo toggles a single class — value is a (maybe-signal) boolean,
        // matching bind_attrs' `class.foo` semantics.
        [k: `class:${string}`]: MaybeSignal<boolean>;
    };

    type NamespacedAttributes = StyleNamespace & ClassNamespace;

    type IntrinsicElements = {
        [K in keyof HTMLElementTagNameMap]:
            // 1. Base HTML attributes, made signal-compatible (minus style/class,
            //    which we type explicitly below).
            Omit<SignalCompatible<Partial<HTMLElementTagNameMap[K]>>, "style" | "className">
            // 2. Namespaced keys (style:*, class:*) with precise per-field types.
            & NamespacedAttributes
            & {
                // Whole-style prop: string or a signal-compatible CSS object.
                style?: MaybeSignal<string> | SignalCompatible<Partial<CSSStyleDeclaration>>;

                // Whole-class prop (both spellings your runtime accepts).
                class?: MaybeSignal<string>;
                className?: MaybeSignal<string>;

                // Catch-all for data-* and custom attributes. Kept as `unknown`
                // rather than `any` so it can't silently swallow type errors on
                // attributes you haven't explicitly declared; the specific keys
                // above still win for style:* / class:*.
                [propName: string]: unknown;

                children?: Element | Element[] | any;
            };
    };
}