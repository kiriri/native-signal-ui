import { runtime, ForCollection } from "../src/index";
import { NativeSignal, EventManager, MapCollection, MappedCollection, EMPTY } from "native-signal/weak";

const { h, Fragment } = runtime;
void Fragment;

const flush = () => { while (EventManager.waiting_to_emit.length) EventManager.flush(); };
const texts = (el: Element) => Array.from(el.querySelectorAll("li")).map(li => li.textContent);

describe("ForCollection", () =>
{
    test("initial render keeps insertion order", () =>
    {
        const c = new MapCollection<string, string>([["a", "A"], ["b", "B"], ["c", "C"]]);
        const ul = <ul>{ForCollection(c, (v, k) => <li>{k}{v}</li>)}</ul> as HTMLElement;
        expect(texts(ul)).toEqual(["aA", "bB", "cC"]);
    });

    test("add / replace / delete touch only changed entries", () =>
    {
        const c = new MapCollection<string, string>([["a", "A"], ["b", "B"]]);
        let calls = 0;
        const ul = <ul>{ForCollection(c, (v) => { calls++; return <li>{v}</li>; })}</ul> as HTMLElement;
        const [li_a, li_b] = Array.from(ul.querySelectorAll("li"));
        expect(calls).toBe(2);

        c.set("c", "C");
        c.set("d", "D");
        flush();
        expect(texts(ul)).toEqual(["A", "B", "C", "D"]);
        expect(calls).toBe(4);

        c.set("a", "A2");
        flush();
        expect(texts(ul)).toEqual(["A2", "B", "C", "D"]);
        expect(ul.querySelectorAll("li")[1]).toBe(li_b);
        expect(ul.querySelectorAll("li")[0]).not.toBe(li_a);
        expect(calls).toBe(5);

        c.delete("b");
        c.delete("d");
        flush();
        expect(texts(ul)).toEqual(["A2", "C"]);
        expect(calls).toBe(5);

        // delete + re-add in one batch moves to the end
        c.delete("a");
        c.set("a", "A3");
        flush();
        expect(texts(ul)).toEqual(["C", "A3"]);
    });

    test("set to the same value and add+delete in one batch are no-ops", () =>
    {
        const c = new MapCollection<string, string>([["a", "A"]]);
        let calls = 0;
        const ul = <ul>{ForCollection(c, (v) => { calls++; return <li>{v}</li>; })}</ul> as HTMLElement;
        c.set("a", "X"); c.set("a", "A");
        c.set("tmp", "T"); c.delete("tmp");
        flush();
        expect(texts(ul)).toEqual(["A"]);
        expect(calls).toBe(1);
    });

    test("ref() placeholders are not rendered until set", () =>
    {
        const c = new MapCollection<string, string>();
        const ul = <ul>{ForCollection(c, (v) => <li>{v}</li>)}</ul> as HTMLElement;
        c.ref("x");
        flush();
        expect(texts(ul)).toEqual([]);
        c.set("x", "X");
        flush();
        expect(texts(ul)).toEqual(["X"]);
        c.delete("x");
        flush();
        expect(texts(ul)).toEqual([]);
    });

    test("works on a lazy MappedCollection used as a filter", () =>
    {
        const limit = new NativeSignal(2);
        const src = new MapCollection<string, number>([["a", 1], ["b", 2], ["c", 3]]);
        const visible = new MappedCollection(src, (v) => v <= limit.get() ? v : EMPTY as any);
        const ul = <ul>{ForCollection(visible, (v, k) => <li>{k}</li>)}</ul> as HTMLElement;
        // DOM order mirrors the mapped collection's own iteration order (which
        // native-signal currently builds in reverse source order on init).
        const own_order = () => Array.from(visible.get().values())
            .filter(e => e.value !== EMPTY).map(e => e.key);
        expect(texts(ul)).toEqual(own_order());
        expect(texts(ul).sort()).toEqual(["a", "b"]);

        src.set("d", 0);
        flush();
        expect(texts(ul)).toEqual(own_order());
        expect(texts(ul).slice(-1)).toEqual(["d"]);

        src.delete("a");
        flush();
        expect(texts(ul).sort()).toEqual(["b", "d"]);

        // filter flips: a hidden key becomes visible, a visible one gets hidden
        limit.set(3);
        src.set("c", 3); // MappedCollection re-maps on source change
        flush();
        expect(texts(ul).sort()).toEqual(["b", "c", "d"]);
        limit.set(0);
        src.set("b", 2);
        flush();
        expect(texts(ul).sort()).toEqual(["c", "d"]);

    });

    test("mapper reads are not tracked by the list effect", () =>
    {
        const s = new NativeSignal(0);
        const c = new MapCollection<string, string>([["a", "A"]]);
        let calls = 0;
        const ul = <ul>{ForCollection(c, (v) => { calls++; s.get(); return <li>{v}</li>; })}</ul> as HTMLElement;
        s.set(1);
        flush();
        expect(calls).toBe(1);
        expect(texts(ul)).toEqual(["A"]);
    });

    test("multi-node items and nested lists are removed as a whole", () =>
    {
        const inner = new MapCollection<string, string>([["x", "1"]]);
        const c = new MapCollection<string, string>([["a", "A"], ["b", "B"]]);
        const div = <div>{ForCollection(c, (v, k) => k === "a"
            ? [<span>{v}</span>, ForCollection(inner, (iv) => <i>{iv}</i>)]
            : <span>{v}</span>)}</div> as HTMLElement;

        inner.set("y", "2");
        flush();
        expect(div.textContent).toBe("A12B");

        c.delete("a");
        flush();
        expect(div.textContent).toBe("B");
    });
});
