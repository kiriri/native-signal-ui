// Benchmark cases. Bundled once per library variant (see bench/run.mjs) and
// executed in headless Chromium. `@lib` is aliased to the src/ tree under test.
import { runtime, If, ForKeyed } from "@lib";
import { NativeSignal, Computed, EventManager } from "native-signal/weak";

const { h, Fragment } = runtime;
void Fragment;

interface Case
{
    name: string;
    /** Unmeasured. Returns state handed to `run`. */
    setup?: (root: HTMLElement) => any;
    /** Measured. */
    run: (root: HTMLElement, state: any) => void;
}

const ROWS = 1000;

/** Effects are batched into a microtask; drain them synchronously so the DOM work is measured. */
function flush()
{
    while (EventManager.waiting_to_emit.length) EventManager.flush();
}
const noop = () => {};

const ADJ = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint"];
const NOUN = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger"];
const label = (i: number) => `${ADJ[i % ADJ.length]} ${NOUN[(i * 7) % NOUN.length]} ${i}`;

function static_rows(n: number)
{
    const rows: Node[] = [];
    for (let i = 0; i < n; i++)
        rows.push(
            <tr class="row" data-id={i}>
                <td class="col-md-1">{i}</td>
                <td class="col-md-4"><a href="#" onclick={noop}>{label(i)}</a></td>
                <td class="col-md-1"><button type="button" disabled={false} onclick={noop}>x</button></td>
                <td class="col-md-6"></td>
            </tr> as Node,
        );
    return <table><tbody>{rows}</tbody></table>;
}

interface ReactiveRow { id: number; text: NativeSignal<string>; selected: NativeSignal<boolean>; color: NativeSignal<string> }

function reactive_rows(n: number)
{
    const data: ReactiveRow[] = [];
    const rows: Node[] = [];
    for (let i = 0; i < n; i++)
    {
        const row: ReactiveRow = {
            id: i,
            text: new NativeSignal(label(i)),
            selected: new NativeSignal(false),
            color: new NativeSignal("black"),
        };
        data.push(row);
        rows.push(
            <tr class:danger={row.selected} data-id={i}>
                <td class="col-md-1">{i}</td>
                <td class="col-md-4" style:color={row.color}><a title={row.text}>{row.text}</a></td>
                <td class="col-md-1"><button onclick={noop}>x</button></td>
            </tr> as Node,
        );
    }
    return { data, node: <table><tbody>{rows}</tbody></table> };
}

function svg_scene(n: number)
{
    const groups: Node[] = [];
    for (let i = 0; i < n; i++)
        groups.push(
            <g transform={`translate(${i % 40 * 10} ${(i / 40 | 0) * 10})`} class="cell">
                <circle cx={5} cy={5} r={4} fill="steelblue" stroke="black" stroke-width={0.5} />
                <rect x={1} y={1} width={8} height={8} fill="none" stroke="red" />
                <path d="M0 0 L10 10 M10 0 L0 10" stroke="#333" onclick={noop} />
            </g> as Node,
        );
    return <svg viewBox="0 0 400 250" width={400} height={250}>{groups}</svg>;
}

export const cases: Case[] = [
    {
        name: "create 1k static rows",
        run(root) { root.appendChild(static_rows(ROWS) as Node); },
    },
    {
        name: "create 1k reactive rows",
        run(root) { root.appendChild(reactive_rows(ROWS).node as Node); },
    },
    {
        name: "update 1k reactive rows (text+class+style) x4",
        setup(root)
        {
            const r = reactive_rows(ROWS);
            root.appendChild(r.node as Node);
            return { data: r.data, tick: 0 };
        },
        run(_root, s)
        {
            for (let k = 0; k < 4; k++)
            {
                const t = ++s.tick;
                for (const row of s.data as ReactiveRow[])
                {
                    row.text.set(label(row.id + t));
                    row.selected.set((row.id + t) % 2 === 0);
                    row.color.set(t % 2 ? "red" : "blue");
                }
                flush();
            }
        },
    },
    {
        name: "ForKeyed create 1k + swap + replace",
        run(root)
        {
            const list = new NativeSignal<{ id: number; text: string }[]>([]);
            root.appendChild(
                <ul>{ForKeyed("id", list, (item) => <li class="item"><span>{item.text}</span></li> as JSX.Element)}</ul> as Node,
            );
            const a: { id: number; text: string }[] = [];
            for (let i = 0; i < ROWS; i++) a.push({ id: i, text: label(i) });
            list.set(a);
            flush();
            const b = a.slice();
            const tmp = b[1]; b[1] = b[998]; b[998] = tmp;
            list.set(b);
            flush();
            const c: { id: number; text: string }[] = [];
            for (let i = 0; i < ROWS; i++) c.push({ id: ROWS + i, text: label(i) });
            list.set(c);
        },
    },
    {
        name: "If x1k toggle 40x",
        setup(root)
        {
            const show = new NativeSignal(true);
            const items: Node[] = [];
            for (let i = 0; i < ROWS; i++)
                items.push(<div>{If(show, () => <span class="on">{i}</span>)}</div> as Node);
            root.appendChild(<div>{items}</div> as Node);
            return show;
        },
        run(_root, show: NativeSignal<boolean>)
        {
            for (let i = 0; i < 40; i++) { show.set(!show.get()); flush(); }
        },
    },
    {
        name: "reactive child (Computed) 4k create",
        run(root)
        {
            const base = new NativeSignal(1);
            const items: Node[] = [];
            for (let i = 0; i < 4 * ROWS; i++)
                items.push(<p>value: {new Computed(() => base.get() * i)}</p> as Node);
            root.appendChild(<div>{items}</div> as Node);
        },
    },
    {
        name: "SVG create 1k groups (3 shapes each)",
        run(root) { root.appendChild(svg_scene(ROWS) as Node); },
    },
    {
        // Floor for the case above: the same DOM built by hand, no framework.
        name: "SVG create 1k groups — vanilla DOM",
        run(root)
        {
            const NS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(NS, "svg");
            svg.setAttribute("viewBox", "0 0 400 250");
            svg.setAttribute("width", "400");
            svg.setAttribute("height", "250");
            for (let i = 0; i < ROWS; i++)
            {
                const g = document.createElementNS(NS, "g");
                g.setAttribute("transform", `translate(${i % 40 * 10} ${(i / 40 | 0) * 10})`);
                g.setAttribute("class", "cell");
                const c = document.createElementNS(NS, "circle");
                c.setAttribute("cx", "5"); c.setAttribute("cy", "5"); c.setAttribute("r", "4");
                c.setAttribute("fill", "steelblue"); c.setAttribute("stroke", "black"); c.setAttribute("stroke-width", "0.5");
                const r = document.createElementNS(NS, "rect");
                r.setAttribute("x", "1"); r.setAttribute("y", "1"); r.setAttribute("width", "8"); r.setAttribute("height", "8");
                r.setAttribute("fill", "none"); r.setAttribute("stroke", "red");
                const p = document.createElementNS(NS, "path");
                p.setAttribute("d", "M0 0 L10 10 M10 0 L0 10"); p.setAttribute("stroke", "#333");
                p.addEventListener("click", noop);
                g.append(c, r, p);
                svg.appendChild(g);
            }
            root.appendChild(svg);
        },
    },
    {
        name: "SVG update 1k reactive attrs x10",
        setup(root)
        {
            const sigs: NativeSignal<number>[] = [];
            const circles: Node[] = [];
            for (let i = 0; i < ROWS; i++)
            {
                const s = new NativeSignal(i % 400);
                sigs.push(s);
                circles.push(<circle cx={s} cy={i / 4} r={2} fill="teal" /> as Node);
            }
            root.appendChild(<svg viewBox="0 0 400 250">{circles}</svg> as Node);
            return { sigs, tick: 0 };
        },
        run(_root, s)
        {
            for (let k = 0; k < 10; k++)
            {
                const t = ++s.tick;
                for (let i = 0; i < s.sigs.length; i++) s.sigs[i].set((i + t) % 400);
                flush();
            }
        },
    },
    {
        // Floor for the case above.
        name: "SVG update 1k attrs x10 — vanilla DOM",
        setup(root)
        {
            const NS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(NS, "svg");
            const circles: Element[] = [];
            for (let i = 0; i < ROWS; i++)
            {
                const c = document.createElementNS(NS, "circle");
                c.setAttribute("cx", String(i % 400));
                svg.appendChild(c);
                circles.push(c);
            }
            root.appendChild(svg);
            return { circles, tick: 0 };
        },
        run(_root, s)
        {
            for (let k = 0; k < 10; k++)
            {
                const t = ++s.tick;
                for (let i = 0; i < s.circles.length; i++) s.circles[i].setAttribute("cx", String((i + t) % 400));
            }
        },
    },
];

/** Run `iterations` measured iterations of case `index`; returns durations in ms. */
export function run_case(index: number, iterations: number): number[]
{
    const c = cases[index];
    const gc: (() => void) | undefined = (globalThis as any).gc;
    const out: number[] = [];
    for (let i = 0; i < iterations; i++)
    {
        const root = document.createElement("div");
        document.body.appendChild(root);
        const state = c.setup?.(root);
        flush();
        gc?.();
        const t0 = performance.now();
        c.run(root, state);
        flush();
        out.push(performance.now() - t0);
        root.remove();
    }
    return out;
}

export const case_names = cases.map(c => c.name);
