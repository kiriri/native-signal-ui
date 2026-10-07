import { runtime, If } from "../src/index";
import { NativeSignal, EventManager } from "native-signal/weak";

const { h, Fragment } = runtime;
void Fragment;

const SVG = "http://www.w3.org/2000/svg";
const HTML = "http://www.w3.org/1999/xhtml";
const XLINK = "http://www.w3.org/1999/xlink";

const flush = () => { while (EventManager.waiting_to_emit.length) EventManager.flush(); };

describe("SVG namespace", () =>
{
    test("SVG tags are created in the SVG namespace", () =>
    {
        const svg = <svg viewBox="0 0 10 10">
            <g>
                <circle cx={5} cy={5} r={4} />
                <linearGradient id="grad"><stop offset="0" /></linearGradient>
                <foreignObject><div>html</div></foreignObject>
            </g>
        </svg> as SVGSVGElement;

        expect(svg.namespaceURI).toBe(SVG);
        expect(svg.querySelector("circle")!.namespaceURI).toBe(SVG);
        // camelCase local names survive (createElement would lowercase them)
        expect(svg.querySelector("g")!.children[1].localName).toBe("linearGradient");
        expect(svg.querySelector("foreignObject")!.namespaceURI).toBe(SVG);
        expect(svg.querySelector("div")!.namespaceURI).toBe(HTML);
    });

    test("ambiguous tags default to HTML, svg: prefix selects SVG", () =>
    {
        const html_a = <a href="#x">link</a> as Element;
        const svg_a = <svg:a href="#x"><svg:title>tip</svg:title></svg:a> as Element;

        expect(html_a.namespaceURI).toBe(HTML);
        expect(svg_a.namespaceURI).toBe(SVG);
        expect(svg_a.localName).toBe("a");
        expect(svg_a.firstElementChild!.namespaceURI).toBe(SVG);
        expect(svg_a.firstElementChild!.localName).toBe("title");
        expect((<svg:circle /> as Element).namespaceURI).toBe(SVG);
    });

    test("HTML elements are unaffected", () =>
    {
        const div = <div class="x"><span>hi</span></div> as HTMLElement;
        expect(div.namespaceURI).toBe(HTML);
        expect(div.className).toBe("x");
    });
});

describe("SVG attributes", () =>
{
    test("static attributes are set verbatim", () =>
    {
        const el = <rect x={1} width="8" stroke-width={0.5} viewBox="0 0 1 1" fill={null} visibility={undefined} /> as SVGElement;
        expect(el.getAttribute("x")).toBe("1");
        expect(el.getAttribute("width")).toBe("8");
        expect(el.getAttribute("stroke-width")).toBe("0.5");
        expect(el.getAttribute("viewBox")).toBe("0 0 1 1");
        expect(el.hasAttribute("fill")).toBe(false);
        expect(el.hasAttribute("visibility")).toBe(false);
    });

    test("class / className go through the attribute", () =>
    {
        expect((<circle class="a b" /> as SVGElement).getAttribute("class")).toBe("a b");
        expect((<circle className="c" /> as SVGElement).getAttribute("class")).toBe("c");
    });

    test("reactive attributes and class", () =>
    {
        const cx = new NativeSignal(1);
        const cls = new NativeSignal("one");
        const on = new NativeSignal(false);
        const el = <circle cx={cx} className={cls} class:active={on} /> as SVGElement;

        expect(el.getAttribute("cx")).toBe("1");
        expect(el.getAttribute("class")).toBe("one");

        cx.set(7);
        cls.set("two");
        flush();
        on.set(true);
        flush();
        expect(el.getAttribute("cx")).toBe("7");
        expect(el.classList.contains("two")).toBe(true);
        expect(el.classList.contains("active")).toBe(true);
    });

    test("xlink:href uses the xlink namespace", () =>
    {
        const target = new NativeSignal("#a");
        const el = <use xlink:href={target} /> as SVGElement;
        expect(el.getAttributeNS(XLINK, "href")).toBe("#a");
        target.set("#b");
        flush();
        expect(el.getAttributeNS(XLINK, "href")).toBe("#b");
    });

    test("style and events", () =>
    {
        const color = new NativeSignal("red");
        let clicks = 0;
        const el = <path d="M0 0" style:fill={color} onclick={() => clicks++} /> as SVGElement;
        expect(el.style.getPropertyValue("fill")).toBe("red");
        color.set("blue");
        flush();
        expect(el.style.getPropertyValue("fill")).toBe("blue");
        el.dispatchEvent(new Event("click"));
        expect(clicks).toBe(1);
    });

    test("reactive children and control flow inside <svg>", () =>
    {
        const label = new NativeSignal("a");
        const show = new NativeSignal(false);
        const svg = <svg>
            <text>{label}</text>
            {If(show, () => <circle r={1} />)}
        </svg> as SVGSVGElement;

        expect(svg.querySelector("text")!.textContent).toBe("a");
        expect(svg.querySelector("circle")).toBeNull();
        label.set("b");
        show.set(true);
        flush();
        expect(svg.querySelector("text")!.textContent).toBe("b");
        expect(svg.querySelector("circle")!.namespaceURI).toBe(SVG);
    });
});
