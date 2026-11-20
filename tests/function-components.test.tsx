import { runtime, Component } from "../src/index";
import { NativeSignal, EventManager } from "native-signal/weak";

const { h, Fragment } = runtime;
void Fragment;

const flush = () => { while (EventManager.waiting_to_emit.length) EventManager.flush(); };

describe("function components", () =>
{
    test("is called with its props and returns its node as-is", () =>
    {
        let calls = 0;
        function Pill({ label }: { label: string }) { calls++; return <span class="pill">{label}</span>; }

        const el = <Pill label="open" /> as HTMLElement;
        expect(calls).toBe(1);
        expect(el.outerHTML).toBe(`<span class="pill">open</span>`);
    });

    test("children arrive as both `content` and `children`", () =>
    {
        const seen: any[] = [];
        function Box(p: { content?: any; children?: any }) { seen.push(p); return <div>{p.content}</div>; }

        const one = <Box>only</Box> as HTMLElement;
        const two = <Box><b>a</b><i>b</i></Box> as HTMLElement;

        expect(seen[0].content).toBe("only");
        expect(seen[0].children).toBe("only");
        expect(Array.isArray(seen[1].content)).toBe(true);
        expect(seen[1].children).toBe(seen[1].content);
        expect(one.textContent).toBe("only");
        expect(two.innerHTML).toBe("<b>a</b><i>b</i>");
    });

    test("an explicit `content` / `children` prop is not overwritten", () =>
    {
        let got: any;
        function Box(p: any) { got = p; return <div />; }
        <Box content="mine" children="also mine">kid</Box>;
        expect(got.content).toBe("mine");
        expect(got.children).toBe("also mine");
    });

    test("a non-node result is wrapped in a fragment, signals stay live", () =>
    {
        const v = new NativeSignal("a");
        function Text() { return v; }
        function List() { return [<li>1</li>, <li>2</li>]; }

        const ul = <ul><List /></ul> as HTMLElement;
        expect(ul.querySelectorAll("li").length).toBe(2);

        const p = <p><Text /></p> as HTMLElement;
        expect(p.textContent).toBe("a");
        v.set("b");
        flush();
        expect(p.textContent).toBe("b");
    });

    test("a returned Component is passed through", () =>
    {
        class Card extends Component<HTMLDivElement>
        {
            root = <div class="card" /> as HTMLDivElement;
        }
        const card = new Card();
        function Make() { return card; }
        expect(<Make />).toBe(card);
    });
});
