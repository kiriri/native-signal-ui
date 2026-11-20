import { Computed, NativeSignal, EventManager } from "native-signal/weak";
import { create_translations } from "../src/i18n/index";

const flush = () => { while (EventManager.waiting_to_emit.length) EventManager.flush(); };

const LANGUAGES = ["de-DE", "en-US"] as const;

function setup(initial: string = "de-DE")
{
    const locale = new NativeSignal<string>(initial);
    const t = create_translations({ languages: LANGUAGES, locale });
    return { locale, t };
}

describe("i18n", () =>
{
    test("a key reads the active locale and follows it", () =>
    {
        const { locale, t } = setup();
        const tr = t.create({ title: { "de-DE": "Titel", "en-US": "Title" } });

        expect(tr.title.get()).toBe("Titel");
        locale.set("en-US");
        flush();
        expect(tr.title.get()).toBe("Title");
    });

    test("a locale outside `languages` reads the fallback, languages[0] by default", () =>
    {
        const { t } = setup("fr-FR");
        const tr = t.create({ title: { "de-DE": "Titel", "en-US": "Title" } });
        expect(tr.title.get()).toBe("Titel");

        const locale = new NativeSignal("fr-FR");
        const t2 = create_translations({ languages: LANGUAGES, locale, fallback: "en-US" });
        expect(t2.create({ title: { "de-DE": "Titel", "en-US": "Title" } }).title.get()).toBe("Title");
    });

    test("the locale may be a Computed", () =>
    {
        const user_locale = new NativeSignal<string | null>(null);
        const locale = new Computed(() => user_locale.get() ?? "en-US");
        const tr = create_translations({ languages: LANGUAGES, locale })
            .create({ title: { "de-DE": "Titel", "en-US": "Title" } });

        expect(tr.title.get()).toBe("Title");
        user_locale.set("de-DE");
        flush();
        expect(tr.title.get()).toBe("Titel");
    });

    test("extended keys resolve through nested providers and share one Computed", () =>
    {
        const { locale, t } = setup();
        const base = t.create({ cancel: { "de-DE": "Abbrechen", "en-US": "Cancel" } });
        const mid = t.create({ save: { "de-DE": "Speichern", "en-US": "Save" } }, base);
        const page = t.create({ title: { "de-DE": "Titel", "en-US": "Title" } }, mid);

        expect(page.cancel.get()).toBe("Abbrechen");
        expect(page.save.get()).toBe("Speichern");
        expect(page.cancel).toBe(base.cancel);
        expect(page.title).toBe(page.title);

        locale.set("en-US");
        flush();
        expect(page.cancel.get()).toBe("Cancel");
    });

    test("an own key wins over an extended one", () =>
    {
        const { t } = setup();
        const base = t.create({ title: { "de-DE": "Basis", "en-US": "Base" } });
        const page = t.create({ title: { "de-DE": "Seite", "en-US": "Page" } }, base);
        expect(page.title.get()).toBe("Seite");
    });

    test("keys named like methods or object members are plain keys", () =>
    {
        const { t } = setup();
        const tr = t.create({
            get:         { "de-DE": "holen", "en-US": "get" },
            has:         { "de-DE": "hat", "en-US": "has" },
            constructor: { "de-DE": "Konstruktor", "en-US": "constructor" },
        });
        expect(tr.get.get()).toBe("holen");
        expect(tr.has.get()).toBe("hat");
        expect(tr.constructor.get()).toBe("Konstruktor");
        expect("get" in tr).toBe(true);
    });

    test("an unknown key reads as undefined", () =>
    {
        const { t } = setup();
        const tr = t.create({ title: { "de-DE": "Titel", "en-US": "Title" } });
        expect((tr as any).missing).toBeUndefined();
        expect((tr as any).toString).toBeUndefined();
        expect("missing" in tr).toBe(false);
    });

    test("a raw map passed to extend is refused at once", () =>
    {
        const { t } = setup();
        const raw = { cancel: { "de-DE": "Abbrechen", "en-US": "Cancel" } };
        expect(() => t.create({}, raw as any)).toThrow(/raw maps/);
    });

    test("a computed text follows its own state as well as the locale", () =>
    {
        const { locale, t } = setup();
        const formal = new NativeSignal(false);
        const greeting = new Computed(() => formal.get() ? "Guten Tag" : "Hallo");
        const tr = t.create({ hello: { "de-DE": greeting, "en-US": "Hello" } });

        expect(tr.hello.get()).toBe("Hallo");
        formal.set(true);
        flush();
        expect(tr.hello.get()).toBe("Guten Tag");

        locale.set("en-US");
        flush();
        expect(tr.hello.get()).toBe("Hello");
        // Switching back reads the computed text's current state, not a stale one.
        formal.set(false);
        locale.set("de-DE");
        flush();
        expect(tr.hello.get()).toBe("Hallo");
    });

    test("a computed text reaches a provider that extends it", () =>
    {
        const { t } = setup();
        const formal = new NativeSignal(false);
        const base = t.create({ hello: { "de-DE": new Computed(() => formal.get() ? "Guten Tag" : "Hallo"), "en-US": "Hello" } });
        const page = t.create({}, base);

        expect(page.hello.get()).toBe("Hallo");
        formal.set(true);
        flush();
        expect(page.hello.get()).toBe("Guten Tag");
    });

    test("a writable signal is a text too", () =>
    {
        const { t } = setup();
        const name = new NativeSignal("Anna");
        const tr = t.create({ who: { "de-DE": name, "en-US": "someone" } });
        expect(tr.who.get()).toBe("Anna");
        name.set("Bert");
        flush();
        expect(tr.who.get()).toBe("Bert");
    });

    test("two systems keep separate locales", () =>
    {
        const app = setup("de-DE");
        const editor = setup("en-US");
        const map = { title: { "de-DE": "Titel", "en-US": "Title" } } as const;

        expect(app.t.create(map).title.get()).toBe("Titel");
        expect(editor.t.create(map).title.get()).toBe("Title");
    });
});

// ── Compile-time checks: `tsc` over this file must pass (see docs/i18n.md) ──
function type_checks()
{
    const { t } = setup();
    const base = t.create({ cancel: { "de-DE": "Abbrechen", "en-US": "Cancel" } });
    const page = t.create({ title: { "de-DE": "Titel", "en-US": "Title" } }, base);

    const own: Computed<"Titel" | "Title"> = page.title;
    const inherited: Computed<string> = page.cancel;
    void own; void inherited;

    // @ts-expect-error an entry must name every language
    t.create({ title: { "de-DE": "Titel" } });
    // A misspelt language fails because the correct one is then missing. An
    // extra language on top of all required ones is allowed (and ignored).
    // @ts-expect-error "en-us" leaves "en-US" missing
    t.create({ title: { "de-DE": "Titel", "en-us": "Title" } });
    // @ts-expect-error unknown key
    void page.missing;
    // Keys through two levels of extend are typed, and `keyof` is the keys
    // alone: code indexing a provider with a computed key gets Computeds only.
    const mid = t.create({ save: { "de-DE": "Speichern", "en-US": "Save" } }, base);
    const top = t.create({ head: { "de-DE": "Kopf", "en-US": "Head" } }, mid);
    const deep: Computed<string> = top.cancel;
    void deep;
    const exact_keys: Array<keyof typeof top> = ["head", "save", "cancel"];
    // @ts-expect-error nothing but the keys is in keyof
    const no_more_keys: Array<keyof typeof top> = ["get"];
    void exact_keys; void no_more_keys;
    const any_key = (k: keyof typeof top): Computed<string> => top[k];
    void any_key;

    // A computed text reads as a string; a written-out one keeps its literal type.
    const mixed = t.create({ hello: { "de-DE": new Computed(() => "Hallo"), "en-US": "Hello" } });
    const computed_text: Computed<string> = mixed.hello;
    void computed_text;
    // @ts-expect-error a text must be a string or read as one
    t.create({ count: { "de-DE": new Computed(() => 1), "en-US": "one" } });

    // @ts-expect-error extend takes providers, not raw maps
    t.create({}, { cancel: { "de-DE": "Abbrechen", "en-US": "Cancel" } });

    // @ts-expect-error fallback must be one of `languages`
    create_translations({ languages: LANGUAGES, locale: new NativeSignal("de-DE"), fallback: "fr-FR" });
}
void type_checks;
