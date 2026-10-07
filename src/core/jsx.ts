// This file must stay a *module* (note the `export {}` at the bottom) so that
// `declare global` is legal. A side-effect import of it from the package entry
// (`import "./core/jsx"` in src/index.ts) is what pulls this global JSX
// augmentation into any project that imports the package — without it, the
// global `JSX` namespace would never reach consumers and they'd see
// "JSX.IntrinsicElements is not defined".

declare global {
    namespace JSX {
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

        // Shared by every element, svg and dom alike.
        type CommonAttributes = {
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

        type HTMLIntrinsicElements = {
            [K in keyof HTMLElementTagNameMap]:
                // 1. Base HTML attributes, made signal-compatible (minus style/class,
                //    which we type explicitly below).
                Omit<SignalCompatible<Partial<HTMLElementTagNameMap[K]>>, "style" | "className">
                // 2. Namespaced keys (style:*, class:*) with precise per-field types.
                & NamespacedAttributes
                & CommonAttributes;
        };

        ///
        // SVG
        //
        // SVG DOM properties are read-only SVGAnimated* objects, so they can't be handled as dom properties.
        // They are listed under `SVGAttributeName`
        ///
        type SVGAttributeValue = MaybeSignal<string | number | null | undefined>;

        type SVGAttributeName =
            | "id" | "tabindex" | "role" | "lang" | "xmlns" | "xmlns:xlink"
            | "viewBox" | "preserveAspectRatio" | "width" | "height"
            | "x" | "y" | "x1" | "y1" | "x2" | "y2" | "cx" | "cy" | "r" | "rx" | "ry" | "fx" | "fy" | "fr"
            | "d" | "points" | "pathLength" | "transform" | "transform-origin"
            | "fill" | "fill-opacity" | "fill-rule"
            | "stroke" | "stroke-width" | "stroke-opacity" | "stroke-linecap" | "stroke-linejoin"
            | "stroke-dasharray" | "stroke-dashoffset" | "stroke-miterlimit"
            | "opacity" | "color" | "display" | "visibility" | "overflow" | "cursor" | "pointer-events"
            | "clip-path" | "clip-rule" | "mask" | "filter"
            | "marker-start" | "marker-mid" | "marker-end"
            | "markerWidth" | "markerHeight" | "markerUnits" | "refX" | "refY" | "orient"
            | "href" | "xlink:href" | "target"
            | "offset" | "stop-color" | "stop-opacity"
            | "gradientUnits" | "gradientTransform" | "spreadMethod"
            | "patternUnits" | "patternContentUnits" | "patternTransform"
            | "clipPathUnits" | "maskUnits" | "maskContentUnits" | "filterUnits" | "primitiveUnits"
            | "text-anchor" | "dominant-baseline" | "alignment-baseline" | "baseline-shift"
            | "font-family" | "font-size" | "font-style" | "font-weight" | "letter-spacing" | "word-spacing"
            | "text-decoration" | "dx" | "dy" | "rotate" | "textLength" | "lengthAdjust"
            | "startOffset" | "method" | "spacing" | "side"
            | "vector-effect" | "paint-order" | "shape-rendering" | "text-rendering" | "image-rendering"
            | "in" | "in2" | "result" | "stdDeviation" | "values" | "type" | "mode" | "operator"
            | "k1" | "k2" | "k3" | "k4" | "scale" | "xChannelSelector" | "yChannelSelector"
            | "flood-color" | "flood-opacity" | "lighting-color" | "color-interpolation-filters"
            | "attributeName" | "from" | "to" | "by" | "dur" | "begin" | "end" | "repeatCount"
            | "repeatDur" | "keyTimes" | "keySplines" | "calcMode" | "additive" | "accumulate"
            | "path" | "keyPoints";

        type EventHandlers = {
            [K in keyof GlobalEventHandlers as K extends `on${string}` ? K : never]?: GlobalEventHandlers[K];
        };

        type SVGAttributes =
            { [K in SVGAttributeName]?: SVGAttributeValue }
            & EventHandlers
            & NamespacedAttributes
            & CommonAttributes;

        // `a`, `script`, `style` and `title` exist in both namespaces. 
        // When in doubt, they are deemed html, because the parser is bottom-up. 
        // Use `svg:*` to force them to be svg elements.
        type SVGIntrinsicElements =
            & { [K in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: SVGAttributes }
            & { [K in keyof SVGElementTagNameMap as `svg:${K}`]: SVGAttributes };

        type IntrinsicElements = HTMLIntrinsicElements & SVGIntrinsicElements;
    }
}

export {};
