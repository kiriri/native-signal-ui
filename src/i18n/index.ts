import { Computed } from "native-signal/weak";

/// Reactive translations: `tr.title` is a `Computed<string>` that follows a
/// locale the app supplies. See docs/i18n.md.

/**
 * A text that is not fixed: anything readable whose `get()` is tracked, a
 * `NativeSignal<string>` or `Computed<string>`. Read inside the key's Computed,
 * so the key follows it as it follows the locale.
 */
export interface TextSource
{
    get(): string;
}

/** One language's text: written out, or computed from other state. */
export type TranslationText = string | TextSource;

/** One key's text in every supported language. */
export type Translation<L extends string> = Record<L, TranslationText>;

/** Keys to their texts, as written in a translation file. */
export type TranslationMap<L extends string> = Record<string, Translation<L>>;

/** Anything readable whose `get()` is tracked: a `NativeSignal` or `Computed`. */
export interface LocaleSource
{
    get(): string;
}

export interface TranslationOptions<L extends readonly [string, ...string[]]>
{
    /** Every supported language tag. Each entry must carry a text for all of them. */
    languages: L;
    /**
     * Where the active locale comes from. The app passes whatever already
     * decides it (a Computed over user and settings); a tool that needs to set
     * the language itself passes a writable signal.
     */
    locale: LocaleSource;
    /**
     * Read when an entry has no text for the active locale, which happens only
     * when the locale is not one of `languages`. Defaults to `languages[0]`.
     */
    fallback?: L[number];
}

// The real provider behind a proxy. Kept under a symbol so that no translation
// key, whatever its name, can shadow it. Runtime only: it is deliberately not
// in the proxy's type, so `keyof typeof tr` is exactly the translation keys.
const PROVIDER = Symbol("translation provider");

/** What `extend` accepts: a provider made by `create`. A raw map does not fit. */
export type AnyTranslationProxy = { readonly [key: string]: Computed<string> };

// Every key of the extended providers. A provider's type already lists the keys
// it inherits as its own properties, so one level of `keyof` sees the whole
// chain. Distributive over the tuple's members; the empty tuple gives `never`.
// The string a key reads as. A written-out text keeps its literal type, a
// computed one is whatever its `get()` returns.
type TextOf<V> = V extends string ? V : V extends { get(): infer S extends string } ? S : string;

type InheritedKeys<E extends readonly AnyTranslationProxy[]> =
    E[number] extends infer P ? (P extends unknown ? Extract<keyof P, string> : never) : never;

/**
 * What `create` returns: every key is a `Computed<string>` in the active locale,
 * including the keys of every provider it extends.
 */
export type TranslationProxy<
    T extends TranslationMap<any>,
    E extends readonly AnyTranslationProxy[],
> =
    // Homomorphic over T, so ctrl-click on `tr.title` jumps to the entry.
    & { readonly [K in keyof T]: Computed<TextOf<T[K][keyof T[K]]>> }
    // Inherited keys: their entries live elsewhere, so no go-to-definition.
    & { readonly [K in Exclude<InheritedKeys<E>, keyof T>]: Computed<string> };

/** A text's current string. A computed one is read here, so the caller tracks it. */
function read(text: TranslationText): string
{
    return typeof text === "string" ? text : text.get();
}

class TranslationProvider
{
    private readonly cache = new Map<string, Computed<string>>();

    constructor(
        private readonly map: TranslationMap<string>,
        private readonly extend: readonly TranslationProvider[],
        private readonly locale: LocaleSource,
        private readonly fallback: string,
    ) {}

    has(key: string): boolean
    {
        return Object.hasOwn(this.map, key) || this.extend.some(p => p.has(key));
    }

    get(key: string): Computed<string> | undefined
    {
        const cached = this.cache.get(key);
        if (cached)
            return cached;

        let computed: Computed<string>;
        if (Object.hasOwn(this.map, key))
        {
            const entry = this.map[key];
            const { locale, fallback } = this;
            computed = new Computed(() => read(entry[locale.get()] ?? entry[fallback]));
        }
        else
        {
            // An extended key resolves to the extended provider's own Computed,
            // so it is shared, not duplicated per provider.
            const computed_elsewhere = this.extend.find(p => p.has(key))?.get(key);
            if (!computed_elsewhere)
                return undefined;
            computed = computed_elsewhere;
        }

        this.cache.set(key, computed);
        return computed;
    }
}

/** A configured translation system: `create` builds providers bound to its locale. */
export interface Translations<L extends readonly [string, ...string[]]>
{
    readonly languages: L;
    readonly locale: LocaleSource;
    /**
     * A provider over `map`, falling back to the providers in `extend` for keys
     * it does not define itself. Every entry must name every language in
     * `languages`; that is checked at compile time.
     */
    create<
        const T extends TranslationMap<L[number]>,
        const E extends readonly AnyTranslationProxy[],
    >(map: T, ...extend: E): TranslationProxy<T, E>;
}

/**
 * Set up translations for one app. Call once and export the result; each
 * translation file then calls its `create`.
 *
 * ```ts
 * export const TranslationProvider = create_translations({ languages: ["de-DE", "en-US"] as const, locale });
 * ```
 */
export function create_translations<const L extends readonly [string, ...string[]]>(
    options: TranslationOptions<L>,
): Translations<L>
{
    const { languages, locale } = options;
    const fallback = options.fallback ?? languages[0];

    return {
        languages,
        locale,
        create(map, ...extend)
        {
            const providers = extend.map(p =>
            {
                const provider = (p as unknown as { [PROVIDER]?: TranslationProvider })[PROVIDER];
                if (!provider)
                    throw new TypeError("create(map, ...extend): extend takes providers made by create, not raw maps; spread a map into `map` instead");
                return provider;
            });
            const provider = new TranslationProvider(map, providers, locale, fallback);

            // Only translation keys are visible, so a key may be called anything
            // ("get", "has", "constructor") without colliding with the provider.
            return new Proxy({}, {
                get: (_, prop) =>
                    prop === PROVIDER ? provider
                    : typeof prop === "string" ? provider.get(prop)
                    : undefined,
                has: (_, prop) => typeof prop === "string" && provider.has(prop),
            }) as TranslationProxy<typeof map, typeof extend>;
        },
    };
}
