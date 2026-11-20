import { runtime, ForCollection } from "../src/index";
import { MapCollection, type KeyedCollection } from "native-signal/weak";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

const { h, Fragment } = runtime;
void Fragment;

setFlagsFromString("--expose-gc");
const gc: () => void = runInNewContext("gc");

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** gc + wait until `cond`. `WeakRef.deref()` pins its target for the current job, so never gc() in the same job as a check. */
async function collect_until(cond: () => boolean, rounds = 30)
{
    for (let i = 0; i < rounds; i++)
    {
        await sleep(0);
        gc();
        await sleep(10);
        if (cond()) return true;
    }
    return false;
}

const consumer_count = (c: KeyedCollection<any, any, any>) => { let n = 0; for (let l = c.consumers; l; l = l.next) n++; return n; };
const live_dependants = (c: any) => { let n = 0; for (let d = c.dependants; d; d = d.next) if (d.value.deref() !== undefined) n++; return n; };

const make = () => new MapCollection<string, string>([["a", "A"], ["b", "B"]]);

describe("ForCollection GC", () =>
{
    test("control: a plain detached element is collectable under happy-dom", async () =>
    {
        let w!: WeakRef<object>;
        (() => { w = new WeakRef(<ul><li>x</li></ul>); })();
        expect(await collect_until(() => w.deref() === undefined)).toBe(true);
    });

    test("list stays alive and reactive while its DOM is referenced", async () =>
    {
        const src = make();
        const ul = <ul>{ForCollection(src, v => <li>{v}</li>)}</ul> as HTMLElement;
        for (let i = 0; i < 5; i++) { await sleep(0); gc(); await sleep(10); }
        src.set("c", "C");
        await sleep(0);
        expect(Array.from(ul.querySelectorAll("li")).map(l => l.textContent)).toEqual(["A", "B", "C"]);
        expect(consumer_count(src)).toBe(1);
    });

    test("dropped list DOM is collected and unlinked while the source lives on", async () =>
    {
        const src = make();
        let li!: WeakRef<object>;
        (() =>
        {
            const ul = <ul>{ForCollection(src, v => <li>{v}</li>)}</ul> as HTMLElement;
            li = new WeakRef(ul.querySelector("li")!);
        })();
        expect(consumer_count(src)).toBe(1);

        expect(await collect_until(() => li.deref() === undefined)).toBe(true);
        expect(await collect_until(() => consumer_count(src) === 0)).toBe(true);
        expect(live_dependants(src)).toBe(0);
        src.set("z", "Z"); // must not touch the dead list
    });

    test("mapper capturing an outer element does not pin the list", async () =>
    {
        const src = make();
        let outer_ref!: WeakRef<object>;
        (() =>
        {
            const outer = <section /> as HTMLElement;
            outer.append(<ul>{ForCollection(src, v => <li title={outer.tagName}>{v}</li>)}</ul>);
            outer_ref = new WeakRef(outer);
        })();
        expect(await collect_until(() => outer_ref.deref() === undefined && consumer_count(src) === 0)).toBe(true);
    });

    test("source + list both unreferenced → everything collected", async () =>
    {
        let refs!: WeakRef<object>[];
        (() =>
        {
            const src = make();
            const ul = <ul>{ForCollection(src, v => <li>{v}</li>)}</ul> as HTMLElement;
            refs = [new WeakRef(src), new WeakRef(ul)];
        })();
        expect(await collect_until(() => refs.every(r => r.deref() === undefined))).toBe(true);
    });

    test("deleted entries' DOM is released while the list lives", async () =>
    {
        const src = make();
        const ul = <ul>{ForCollection(src, v => <li>{v}</li>)}</ul> as HTMLElement;
        let li_a!: WeakRef<object>;
        (() => { li_a = new WeakRef(ul.querySelector("li")!); })();
        src.delete("a");
        await sleep(0);
        expect(await collect_until(() => li_a.deref() === undefined)).toBe(true);
        expect(ul.textContent).toBe("B");
    });
});
