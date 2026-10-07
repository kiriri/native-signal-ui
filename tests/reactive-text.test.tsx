import { runtime } from "../src/index";
import { NativeSignal, EventManager } from "native-signal/weak";

const { h, Fragment } = runtime;
void Fragment;

const flush = () => { while (EventManager.waiting_to_emit.length) EventManager.flush(); };

/** The nodes between a reactive child's anchors. */
const slot_content = (el: Element) => Array.from(el.childNodes).filter(n => n.nodeType !== Node.COMMENT_NODE);

describe("reactive text child", () =>
{
    test("primitive updates rewrite the same text node", () =>
    {
        const v = new NativeSignal<string | number | bigint>("a");
        const p = <p>{v}</p> as HTMLElement;
        const node = slot_content(p)[0];

        v.set("b");
        flush();
        expect(p.textContent).toBe("b");
        expect(slot_content(p)[0]).toBe(node);

        v.set(42);
        flush();
        v.set(7n);
        flush();
        v.set("");
        flush();
        expect(slot_content(p)).toEqual([node]);
        expect(node.textContent).toBe("");
    });

    test("switches between text, nodes and empty", () =>
    {
        const v = new NativeSignal<unknown>("text");
        const p = <p>[{v as any}]</p> as HTMLElement;

        v.set(<b>bold</b>);
        flush();
        expect(p.innerHTML).toContain("<b>bold</b>");
        expect(p.textContent).toBe("[bold]");

        v.set("again");
        flush();
        expect(p.textContent).toBe("[again]");
        expect(p.querySelector("b")).toBeNull();

        v.set(null);
        flush();
        expect(p.textContent).toBe("[]");
        expect(slot_content(p).map(n => n.textContent)).toEqual(["[", "]"]);

        v.set(false);
        flush();
        v.set(3);
        flush();
        expect(p.textContent).toBe("[3]");

        v.set(["x", "y"]);
        flush();
        expect(p.textContent).toBe("[xy]");

        v.set("z");
        flush();
        expect(p.textContent).toBe("[z]");
        expect(slot_content(p)).toHaveLength(3);
    });

    test("a Text node value is inserted as-is, not rewritten", () =>
    {
        const own_text = document.createTextNode("mine");
        const v = new NativeSignal<unknown>(own_text);
        const p = <p>{v as any}</p> as HTMLElement;

        v.set("other");
        flush();
        expect(own_text.data).toBe("mine");
        expect(p.textContent).toBe("other");
    });
});

describe("nested reactive children", () =>
{
    test("a signal inside another signal's value keeps updating after the outer one changes", () =>
    {
        const inner = new NativeSignal("i1");
        const outer = new NativeSignal<unknown>(["a:", inner]);
        const p = <p>{outer as any}</p> as HTMLElement;

        outer.set(["b:", inner]);
        flush();
        expect(p.textContent).toBe("b:i1");

        inner.set("i2");
        flush();
        expect(p.textContent).toBe("b:i2");

        outer.set(["c:", inner]);
        flush();
        inner.set("i3");
        flush();
        expect(p.textContent).toBe("c:i3");
    });

    test("replaced nested signals stop driving the DOM", () =>
    {
        const first = new NativeSignal("first");
        const second = new NativeSignal("second");
        const outer = new NativeSignal<unknown>([first]);
        const p = <p>{outer as any}</p> as HTMLElement;

        outer.set([second]);
        flush();
        first.set("stale");
        flush();
        expect(p.textContent).toBe("second");
        second.set("live");
        flush();
        expect(p.textContent).toBe("live");
    });
});
