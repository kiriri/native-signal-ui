import { runtime } from "../src/index";
import { NativeSignal, EventManager } from "native-signal/weak";

const { h, Fragment } = runtime;
void Fragment;

const flush = () => { while (EventManager.waiting_to_emit.length) EventManager.flush(); };

describe("stringified boolean attributes", () =>
{
    test("plain booleans on aria-* / data-* are written as \"true\" / \"false\"", () =>
    {
        const el = <div aria-hidden={true} aria-expanded={false} data-open={true} /> as HTMLElement;

        expect(el.getAttribute("aria-hidden")).toBe("true");
        expect(el.getAttribute("aria-expanded")).toBe("false");
        expect(el.getAttribute("data-open")).toBe("true");
    });

    test("plain booleans on draggable / spellcheck are written as \"true\" / \"false\"", () =>
    {
        const el = <div draggable={false} spellcheck={true} /> as HTMLElement;

        expect(el.getAttribute("draggable")).toBe("false");
        expect(el.getAttribute("spellcheck")).toBe("true");
    });

    test("reactive booleans on aria-* match the plain ones", () =>
    {
        const hidden = new NativeSignal(true);
        const el = <div aria-hidden={hidden} /> as HTMLElement;

        expect(el.getAttribute("aria-hidden")).toBe("true");
        hidden.set(false);
        flush();
        expect(el.getAttribute("aria-hidden")).toBe("false");
    });

    test("reactive booleans on data-* / spellcheck stay present as \"false\"; only null removes", () =>
    {
        const on = new NativeSignal<boolean | null>(true);
        const el = <div data-open={on} spellcheck={on as any} /> as HTMLElement;

        expect(el.getAttribute("data-open")).toBe("true");
        expect(el.getAttribute("spellcheck")).toBe("true");

        on.set(false);
        flush();
        expect(el.getAttribute("data-open")).toBe("false");
        expect(el.getAttribute("spellcheck")).toBe("false");

        on.set(null);
        flush();
        expect(el.hasAttribute("data-open")).toBe(false);
        expect(el.hasAttribute("spellcheck")).toBe(false);
    });

    test("other plain booleans stay boolean attributes", () =>
    {
        const el = <button disabled={true} hidden={false} /> as HTMLButtonElement;

        expect(el.hasAttribute("disabled")).toBe(true);
        expect(el.hasAttribute("hidden")).toBe(false);
    });
});
