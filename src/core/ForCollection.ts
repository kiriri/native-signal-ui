import { EMPTY, EventManager, KeyedCollectionConsumer, detached } from "native-signal/weak";
import type { KeyedCollection, KeyedCollectionEntry, KeyedCollectionEntryRef } from "native-signal/weak";
import { materialise, type Child } from "./jsx-runtime";
import { own } from "./own";

/** The contiguous top-level DOM range one entry rendered to. */
interface Rendered
{
    first: Node;
    last: Node;
}

/**
 * ForCollection(collection, mapper)
 *
 * Renders a `KeyedCollection` (`MapCollection`, `RecordCollection`,
 * `MappedCollection`, …) as a list. Unlike `ForKeyed`, nothing is diffed: the
 * list is a `KeyedCollectionConsumer`, so each update visits **only the
 * entries that changed** since the last run — O(changes), not O(size).
 *
 *  - entry added    → `mapper(value, key)` runs once, its nodes are appended
 *  - value replaced → `mapper` runs again, the new nodes replace the old ones
 *                     in place (same position)
 *  - entry deleted  → its nodes are removed
 *
 * Order: entries appear in the order they became present (initial entries in
 * the collection's iteration order, later ones appended at the end). A key
 * that is deleted and re-added moves to the end.
 *
 * The mapper only drives structure. To keep an item's DOM stable while its
 * value changes, put a signal/object in the collection and react to it inside
 * the mapper instead of replacing the value.
 *
 * The mapper may return anything JSX accepts (element, fragment, array,
 * component, nested control flow). Its top-level nodes are tracked as a
 * first..last range, so nested `If` / `ForCollection` slots that grow or
 * shrink later are still removed correctly.
 *
 * Usage:
 *   {ForCollection(todos, (todo, id) => <li>{todo.text}</li>)}
 */
export function ForCollection<K, T>(
    collection: KeyedCollection<K, T, any>,
    mapper: (value: T, key: K) => Child,
): DocumentFragment
{
    const frag  = document.createDocumentFragment();
    const start = document.createComment("[for");
    const end   = document.createComment("for]");
    frag.append(start, end);

    const list = new ListState<K, T>(start, end, mapper);

    // GC: the source collection holds the consumer core strongly. If the core
    // could reach this list's DOM, mapper or consumer wrapper, the wrapper would
    // never be finalized and the list would leak for as long as the source lives.
    // So `list` goes in as the consumer's weakly held `context` (dereferenced
    // once per poll, not per entry) and the reducer is a top-level function that
    // captures nothing. `list` is kept alive by owning it on the anchors: it
    // lives exactly as long as the list's DOM.
    const consumer = new KeyedCollectionConsumer<K, T, null, ListState<K, T>>(null, apply_list, collection, list);

    // Registered directly as a dependant of the collection rather than through
    // a `Computed`: there is exactly one fixed dependency and no value, so
    // Computed's dependency tracking and validation would be pure overhead.
    // Coalesced per tick like every other emission. Held weakly by the
    // collection → owned below.
    let scheduled = false;
    const run = () =>
    {
        scheduled = false;
        // Visits only the dirty entries (the reducer). `settle()` first lets lazy
        // upstream sources (MappedCollection) create their entries.
        consumer.core.settle();
        list.insert_before = end;
    };
    const listener = {
        dirty()
        {
            if (scheduled) return;
            scheduled = true;
            EventManager.register_async_emit(run);
        },
    };
    collection.depend(listener as any);

    run();

    own(list, start, end);
    own(listener, start, end);
    own(consumer, start, end);

    return frag;
}

/** Top-level on purpose: captures nothing (see the GC note in ForCollection). */
function apply_list<K, T>(ref: KeyedCollectionEntryRef<K, T>, current: null, list: ListState<K, T>): null
{
    list.apply(ref);
    return current;
}

class ListState<K, T>
{
    // Keyed by entry, not by key: a deleted entry and its re-added successor are
    // distinct objects and may both be pending in the same poll.
    rendered = new Map<KeyedCollectionEntry<K, T>, Rendered>();

    // The dirty list is LIFO, so additions within one poll arrive newest-first.
    // Inserting each one before the previously added one restores their order
    // without sorting. Reset to `end` after every poll.
    insert_before: Node;

    constructor(
        readonly start: Comment,
        readonly end: Comment,
        readonly mapper: (value: T, key: K) => Child,
    )
    {
        this.insert_before = end;
    }

    apply(ref: KeyedCollectionEntryRef<K, T>)
    {
        const entry = ref.ref;
        const old_value = ref.old_value;
        const value = entry.value;

        // EMPTY → EMPTY (e.g. a `ref()` placeholder) or a set back to the value
        // we already rendered: nothing to do.
        if (old_value === value)
            return;

        const rendered = this.rendered;
        if (value === EMPTY)
        {
            const r = rendered.get(entry);
            if (r !== undefined)
            {
                rendered.delete(entry);
                remove(r);
            }
        }
        else if (old_value === EMPTY || !rendered.has(entry))
        {
            const r = this.render(value as T, entry.key, this.insert_before);
            rendered.set(entry, r);
            this.insert_before = r.first;
        }
        else
        {
            const old = rendered.get(entry)!;
            rendered.set(entry, this.render(value as T, entry.key, old.first));
            remove(old);
        }
    }

    render(value: T, key: K, before: Node): Rendered
    {
        const parent = before.parentNode!;
        // Untracked: signals read while building an item belong to that item,
        // not to the list effect.
        const nodes = detached(() => materialise(this.mapper(value, key), this.start));
        // An item must always own at least one node so it has a position.
        if (nodes.length === 0)
            nodes.push(document.createTextNode(""));
        for (const n of nodes)
            parent.insertBefore(n, before);
        return { first: nodes[0], last: nodes[nodes.length - 1] };
    }
}

function remove(r: Rendered)
{
    const parent = r.first.parentNode;
    if (!parent) return;
    let node: Node | null = r.first;
    while (node)
    {
        const next: Node | null = node.nextSibling;
        parent.removeChild(node);
        if (node === r.last) break;
        node = next;
    }
}
