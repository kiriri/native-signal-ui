import { Computed, NativeSignal } from "native-signal/weak";
import { bind_attrs, type AttrValue } from "./bindAttrs";
import { own } from "./own";
import { Component } from "../components/Component";

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

interface Reactive<T = unknown>
{
    get(): T
}


//NativeSignal<T> | Computed<T>;

export type A =
    | number
    | A[];

export type Child =
    | Node
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | JSX.Element
    | Comment
    | DocumentFragment
    | Text
    | Reactive<Child>
    | Promise<Child>
    | { to_html(): Child }
    | Child[];

export function is_reactive(v: unknown): v is Reactive
{
    return v instanceof NativeSignal || v instanceof Computed;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Slot
 *
 * DOM layout:  [start] ...current_nodes... [end]
 *
 * IMPORTANT: The initial nodes are NOT inserted via fill_slot. They are
 * returned to the caller (h / normalize_child) and inserted by normal JSX
 * bottom-up assembly. fill_slot is only called on updates, by which point
 * both anchors are already live in the DOM.
 * ────────────────────────────────────────────────────────────────────────── */

export interface Slot
{
    start: Comment;
    end: Comment;
    children_computeds: Computed<unknown>[];
}

export function create_slot(label: string): Slot
{
    return {
        start: document.createComment(`[${label}`),
        end: document.createComment(`${label}]`),
        children_computeds: [],
    };
}

export function clear_slot(slot: Slot): void
{
    for (const c of slot.children_computeds) c.destroy();
    slot.children_computeds.length = 0;

    const parent = slot.start.parentNode;
    if (!parent || slot.end.parentNode !== parent) return;
    let node = slot.start.nextSibling;
    while (node && node !== slot.end)
    {
        const next = node.nextSibling;
        parent.removeChild(node);
        node = next;
    }
}

export function fill_slot(slot: Slot, nodes: Node[]): void
{
    // Only called on updates — anchors are guaranteed live at this point.
    const parent = slot.end.parentNode!;
    for (const n of nodes) parent.insertBefore(n, slot.end);
}

/* ──────────────────────────────────────────────────────────────────────────
 * normalize_child
 * ────────────────────────────────────────────────────────────────────────── */

export function normalize_child(child: Child, owner: Node, slot: Slot | null): Node[]
{
    if (child === null || child === undefined || typeof child === "boolean")
        return [];

    if (Array.isArray(child))
    {
        const out: Node[] = [];
        for (const c of child)
            for (const n of normalize_child(c, owner, slot)) out.push(n);
        return out;
    }

    if (child instanceof DocumentFragment)
        return Array.from(child.childNodes);

    if (child instanceof Node || child instanceof Comment)
        return [child];


    if (is_reactive(child))
        return mount_reactive(child, owner, slot);

    if (child instanceof Promise)
        return mount_promise(child, owner);

    if (typeof child === "object" && typeof (child as any).to_html === "function")
        return normalize_child((child as { to_html(): Child }).to_html(), owner, slot);

    return [document.createTextNode(String(child))];
}

/* ──────────────────────────────────────────────────────────────────────────
 * mount_reactive
 *
 * First evaluation runs synchronously during JSX construction (bottom-up),
 * before any anchor is in the DOM. We capture the initial nodes and return
 * them to the caller as:
 *
 *   [start, ...initial_nodes, end]
 *
 * The caller appends all of these into the parent element/fragment in order,
 * so the DOM ends up correct without ever calling fill_slot.
 *
 * On every subsequent update, fill_slot is safe because both anchors are
 * live in the DOM by then.
 * ────────────────────────────────────────────────────────────────────────── */

export function mount_reactive(signal: Reactive, _owner: Node, parent_slot: Slot | null): Node[]
{
    const slot = create_slot("sig");
    let initial_nodes: Node[] | null = null;

    const computed = new Computed(() =>
    {
        const value = signal.get() as Child;
        const nodes = normalize_child(value, slot.start, slot);

        if (initial_nodes === null)
        {
            // First run: capture nodes so the caller can insert them.
            // The anchors are not in the DOM yet, so fill_slot would silently
            // discard everything. Return via the captured array instead.
            initial_nodes = nodes;
        } else
        {
            // Subsequent runs: anchors are live, update in place.
            clear_slot(slot);
            fill_slot(slot, nodes);
        }
    }, undefined, true);

    // initial_nodes is always set here because eager Computed runs synchronously.
    own(computed, slot.start);
    if (parent_slot) parent_slot.children_computeds.push(computed);

    return [slot.start, ...initial_nodes!, slot.end];
}

// mount_promise : one-shot, single anchor
export function mount_promise(promise: Promise<Child>, owner: Node): Node[]
{
    const anchor = document.createComment("promise");

    promise.then((value) =>
    {
        const parent = anchor.parentNode;
        if (!parent) return;
        const frag = document.createDocumentFragment();
        for (const n of normalize_child(value, owner, null)) frag.appendChild(n);
        parent.replaceChild(frag, anchor);
    });

    return [anchor];
}

export function bind_style_signal(el: HTMLElement, key: string, signal: Reactive): void
{
    const computed = new Computed(() =>
    {
        const v = signal.get();
        if (v === undefined || v === null)
            el.style.removeProperty(key);
        else
            el.style.setProperty(key, v as string);
    }, undefined, true);
    own(computed, el);
}

export function apply_style_prop(el: HTMLElement, value: unknown, key?: string): void
{
    // Single-property mode: `style:color={...}` routes here with key === "color".
    if (key !== undefined)
    {
        if (is_reactive(value))
            bind_style_signal(el, key, value);
        else if (value === undefined || value === null)
            el.style.removeProperty(key);
        else
            el.style.setProperty(key, value as string);
        return;
    }

    const apply_static = (v: unknown) =>
    {
        if (v && typeof v === "object")
        {
            const obj = v as Record<string, string | number | undefined | null>;
            for (const k in obj)
            {
                const val = obj[k];
                if (val === undefined || val === null)
                    el.style.removeProperty(k);
                else
                    el.style.setProperty(k, val as string);
            }
        }
        else if (typeof v === "string")
        {
            el.setAttribute("style", v);
        }
    };

    if (is_reactive(value))
    {
        const computed = new Computed(() => apply_static(value.get()), undefined, true);
        own(computed, el);
    }
    else if (value && typeof value === "object")
    {
        const obj = value as Record<string, unknown>;
        const plain: Record<string, string | number | undefined | null> = {};
        for (const k in obj)
        {
            const v = obj[k];
            if (is_reactive(v))
                bind_style_signal(el, k, v);
            else
                plain[k] = v as any;
        }
        apply_static(plain);
    }
    else
    {
        apply_static(value);
    }
}

export function apply_prop(el: Element, key: string, value: unknown): void
{
    if (key.startsWith("on") && typeof value === "function")
    {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, value as EventListener);
        return;
    }
    if (key === "class" || key === "className")
    {
        (el as HTMLElement).className = value == null ? "" : value as string;
        return;
    }
    if (key === "style")
    {
        apply_style_prop(el as HTMLElement, value);
        return;
    }
    if (value === undefined || value === null )
    {
        el.removeAttribute(key);
        // clears reflected prop if null
        if (value === null && key in el ) 
        { 
            try 
            { 
                (el as any)[key] = ""; 
            } catch { } 
        } 
        return;
    }
    if (key in el)
    {
        try 
        { 
            (el as any)[key] = value; 
        } catch { }
    }
    else if (value === true)
        el.setAttribute(key, "");
    else
        el.setAttribute(key, String(value));
}

export function apply_props(el: Element, props: Record<string, unknown> | null): void
{
    if (!props) return;
    for (const key in props)
    {
        const value = props[key] as AttrValue;

        // namespace syntax: `style:color`, `class:open`
        const colon = key.indexOf(":");
        if (colon > 0)
        {
            const ns = key.slice(0, colon);
            const sub = key.slice(colon + 1);
            if (ns === "style")
            {
                apply_style_prop(el as HTMLElement, value, sub);
                continue;
            }
            if (ns === "class")
            {
                // Reuse bind_attrs' existing `class.foo` toggle mode.
                bind_attrs(el, { [`class.${sub}`]: value as AttrValue });
                continue;
            }
        }

        if (key === "style") { apply_style_prop(el as HTMLElement, value); continue; }
        if (is_reactive(value)) { bind_attrs(el, { [key]: value }); continue; }
        apply_prop(el, key, value);
    }
}

export function swap_slot(start: Comment, end: Comment, nodes: Node[]): void
{
    const parent = start.parentNode;
    if (!parent || end.parentNode !== parent) return;

    let node = start.nextSibling;
    while (node && node !== end)
    {
        const next = node.nextSibling;
        parent.removeChild(node);
        node = next;
    }

    for (const n of nodes) parent.insertBefore(n, end);
}

/** Eagerly materialise a Child/Child[] into a stable flat Node[]. */
export function materialise(content: Child | Child[], owner: Node): Node[]
{
    const tmp = document.createDocumentFragment();
    const items = Array.isArray(content) ? content : [content];
    for (const c of items)
        for (const n of normalize_child(c, tmp, null)) tmp.appendChild(n);
    return Array.from(tmp.childNodes);
}

/* ──────────────────────────────────────────────────────────────────────────
 * h — the JSX factory
 * ────────────────────────────────────────────────────────────────────────── */

export function h(
    tag: string | typeof Fragment | (new (p: any) => Component),
    props: Record<string, any> | null,
    ...children: Child[]
): JSX.Element | Component<any>
{
    if (typeof tag === "function" && tag.prototype instanceof Component)
    {
        return new (tag as (new (p: any) => Component))({ ...(props ?? {}), content: children });
    }

    if (tag === Fragment)
    {
        const frag = document.createDocumentFragment();
        for (const child of children)
            for (const node of normalize_child(child, frag, null)) frag.appendChild(node);
        return frag;
    }

    if (typeof tag !== "string") throw new Error(`h(): unsupported tag ${String(tag)}`);

    const el = document.createElement(tag);
    apply_props(el, props);
    for (const child of children)
        for (const node of normalize_child(child, el, null)) el.appendChild(node);
    return el;
}

export function Fragment(_props?: { children?: Child }): unknown
{
    return _props?.children;
}