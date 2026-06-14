import { Computed } from "native-signal/weak";
import { own } from "./own";

/**
 * ForKeyed(key, generator, mapper)
 *
 * A keyed variant of For. The generator returns an array of objects; each
 * object must have a unique value at `key`. The mapper is called exactly once
 * per unique key and its returned DOM node is reused for the lifetime of that
 * key — even if the object moves position in the array.
 *
 * The Computed only drives structural changes: insertion, removal, and
 * reordering. Internal reactivity for each item is the mapper's own
 * responsibility (e.g. its own Computed / signals set up inside the mapper).
 *
 * Usage:
 *   ForKeyed(
 *     "id",
 *     () => proxy as { id: string }[],
 *     (item) => buildItemElement(item.id, proxy[indexOf(item.id)])
 *   )
 */
export function ForKeyed<K extends PropertyKey, T extends Record<K, string | number>>(
    key: K,
    generator: (() => T[]) | { get(): T[] },
    mapper: (item: T) => JSX.Element
): { toHtml(): Element }
{
    const start = document.createElement("template");
    const end   = document.createElement("template");

    const fragment = document.createDocumentFragment();
    fragment.append(start, end);

    const fn = "get" in generator ? () => generator.get() : generator;

    // Stable key → node map. Entries are added on first sight and removed when
    // the key is no longer present in the generator output.
    const node_cache = new Map<string | number, JSX.Element>();

    const sync = new Computed(
        () =>
        {
            const items = fn();

            // ── removal pass ──────────────────────────────────────────────────
            // Any key no longer in the new array gets its node detached.
            const next_keys = new Set(items.map(item => item[key]));

            for (const [k, node] of node_cache)
            {
                if (!next_keys.has(k as T[K]))
                {
                    node.parentNode?.removeChild(node);
                    node_cache.delete(k);
                }
            }

            // ── insertion / reorder pass ──────────────────────────────────────
            // Walk the desired order from right to left, inserting or moving
            // each node so that node[i].nextSibling === node[i+1] (or `end`).
            let expected_next: Node = end;

            for (let i = items.length - 1; i >= 0; i--)
            {
                const item = items[i];
                const k    = item[key];

                let node = node_cache.get(k);
                if (!node)
                {
                    node = mapper(item);
                    node_cache.set(k, node);
                }

                if (node.nextSibling !== expected_next)
                    end.parentNode?.insertBefore(node, expected_next);

                expected_next = node;
            }
        },
        undefined,
        true // run as an Effect so it executes immediately and on each change
    );

    own(sync, start);
    own(sync, end);

    return {
        toHtml()
        {
            return fragment as unknown as Element;
        }
    };
}