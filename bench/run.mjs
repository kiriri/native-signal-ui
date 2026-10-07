// Benchmark runner: bundles bench/cases.tsx against one or more src/ trees and
// runs them interleaved in headless Chromium over the DevTools protocol. Each
// variant gets its own browser process: sharing one page/isolate biases
// whichever bundle loads second.
//
//   node bench/run.mjs                      # current src/ only
//   node bench/run.mjs --baseline <dir>     # compare <dir>/src (e.g. a `git archive HEAD src` export) against src/
//   node bench/run.mjs --baseline <a> --current <b>   # compare <a>/src against <b>/src
//
// Options: --rounds N (default 8), --iters N per round (default 5),
//          CHROME=/path/to/chromium (default /usr/bin/chromium)
import { build } from "vite";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");

const args = process.argv.slice(2);
const opt = (name, def) =>
{
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
};
const rounds = Number(opt("--rounds", 8));
const iters = Number(opt("--iters", 5));
const baseline = opt("--baseline", null);

const variants = [];
if (baseline) variants.push({ name: "baseline", src: resolve(baseline, "src") });
variants.push({ name: "current", src: resolve(opt("--current", repo), "src") });

async function bundle(src, global_name)
{
    const out = await build({
        configFile: false,
        logLevel: "silent",
        root: repo,
        esbuild: { jsxFactory: "h", jsxFragment: "Fragment" },
        resolve: {
            alias: [
                { find: /^@lib$/, replacement: join(src, "index.ts") },
                // The baseline tree lives outside the repo; pin native-signal to the repo's copy.
                { find: /^native-signal\/weak$/, replacement: resolve(repo, "node_modules/native-signal/dist/weak/index.js") },
            ],
        },
        build: {
            write: false,
            minify: true,
            target: "es2022",
            lib: { entry: resolve(here, "cases.tsx"), formats: ["iife"], name: global_name },
        },
    });
    return out[0].output[0].code;
}

async function launch()
{
    const chrome = process.env.CHROME ?? "/usr/bin/chromium";
    const profile = mkdtempSync(join(tmpdir(), "bench-chrome-"));
    const proc = spawn(chrome, [
        "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
        "--no-first-run", "--disable-extensions", "--js-flags=--expose-gc", "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });

    const ws_url = await new Promise((ok, fail) =>
    {
        let buf = "";
        proc.stderr.on("data", d =>
        {
            buf += d;
            const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
            if (m) ok(m[1]);
        });
        proc.on("exit", c => fail(new Error(`chromium exited (${c}): ${buf}`)));
    });
    const port = new URL(ws_url).port;
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find(t => t.type === "page");

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener("open", r, { once: true }));
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", e =>
    {
        const msg = JSON.parse(e.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async (expression) =>
    {
        const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails, null, 2));
        return r.result?.result?.value;
    };
    const close = () => { ws.close(); proc.kill(); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500); };
    return { evaluate, close };
}

const quantile = (xs, q) =>
{
    const s = [...xs].sort((a, b) => a - b);
    const p = (s.length - 1) * q;
    const lo = Math.floor(p), hi = Math.ceil(p);
    return s[lo] + (s[hi] - s[lo]) * (p - lo);
};

for (const v of variants) v.browser = await launch();
try
{
    for (const v of variants)
        await v.browser.evaluate(await bundle(v.src, "Bench"));
    const names = await variants[0].browser.evaluate("Bench.case_names");
    const results = names.map(() => variants.map(() => []));

    // Warm-up (JIT) — discarded.
    for (const v of variants)
        for (let c = 0; c < names.length; c++)
            await v.browser.evaluate(`Bench.run_case(${c}, 3)`);

    for (let r = 0; r < rounds; r++)
        for (let c = 0; c < names.length; c++)
        {
            // Alternate order per round to cancel out position effects.
            const order = r % 2 ? [...variants.keys()].reverse() : [...variants.keys()];
            for (const vi of order)
                results[c][vi].push(...await variants[vi].browser.evaluate(`Bench.run_case(${c}, ${iters})`));
        }

    const rows = names.map((name, c) =>
    {
        const row = { case: name };
        variants.forEach((v, vi) =>
        {
            const xs = results[c][vi];
            row[`${v.name} median`] = quantile(xs, 0.5).toFixed(2);
            row[`${v.name} IQR`] = `${quantile(xs, 0.25).toFixed(2)}–${quantile(xs, 0.75).toFixed(2)}`;
        });
        if (variants.length === 2)
        {
            const a = quantile(results[c][0], 0.5), b = quantile(results[c][1], 0.5);
            row["Δ median"] = `${((b / a - 1) * 100).toFixed(1)}%`;
        }
        return row;
    });
    console.log(`ms per iteration, ${rounds * iters} samples per cell`);
    console.table(rows);
}
finally
{
    for (const v of variants) v.browser?.close();
}
