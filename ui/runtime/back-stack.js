// Manages the Escape and back stack in order: menu, sheet, page, settings, suite, chat.

const LAYER_ORDER = ['menu', 'sheet', 'page', 'settings', 'suite', 'chat'];
const LAYER_PRIORITY = new Map(LAYER_ORDER.map((layer, index) => [layer, index]));

/** Creates an ordered back-stack for overlays, pages, settings, and the suite shell. */
export function createBackStack() {
  const buckets = new Map(LAYER_ORDER.map(layer => [layer, []]));
  const watchers = new Set();
  let nextSeq = 1;
  // (told after every push, remove, pop and clear: the browser's Back, ui/runtime/back-history.js, follows the stack)
  const changed = () => { for (const fn of [...watchers]) fn(); };

  function findEntry(id) {
    for (const layer of LAYER_ORDER) {
      const list = buckets.get(layer);
      const idx = list.findIndex(entry => entry.id === id);
      if (idx >= 0) return { layer, list, idx };
    }
    return null;
  }

  function remove(id) {
    const found = findEntry(id);
    if (!found) return false;
    found.list.splice(found.idx, 1);
    changed();
    return true;
  }

  function push({ id = null, layer, close, origin = null, meta = null } = {}) {
    if (!LAYER_PRIORITY.has(layer)) {
      throw new TypeError(`Unknown back-stack layer: ${String(layer)}`);
    }
    if (typeof close !== 'function') {
      throw new TypeError('Back-stack entry requires a close function');
    }
    const entryId = id ?? `back-${nextSeq++}`;
    remove(entryId);
    const entry = { id: entryId, layer, close, origin, meta };
    buckets.get(layer).push(entry);
    changed();
    return () => remove(entryId);
  }

  function peekEntry() {
    for (const layer of LAYER_ORDER) {
      const list = buckets.get(layer);
      if (list.length > 0) return { list, entry: list[list.length - 1] };
    }
    return null;
  }

  function top() {
    const found = peekEntry();
    if (!found) return null;
    const { id, layer, origin, meta } = found.entry;
    return { id, layer, origin, meta };
  }

  function pop() {
    const found = peekEntry();
    if (!found) return null;
    const { list, entry } = found;
    list.pop();
    const result = entry.close({
      id: entry.id,
      layer: entry.layer,
      origin: entry.origin,
      meta: entry.meta,
    });
    if (result === false) {
      list.push(entry);
      changed();
      return null;
    }
    changed();
    return {
      id: entry.id,
      layer: entry.layer,
      origin: entry.origin,
      meta: entry.meta,
    };
  }

  function handleKeydown(event) {
    if (!event || event.key !== 'Escape' || event.defaultPrevented) {
      return false;
    }
    if (!peekEntry()) return false;
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    return pop() !== null;
  }

  function bindDocument(doc) {
    if (!doc || typeof doc.addEventListener !== 'function') {
      return () => {};
    }
    const listener = event => handleKeydown(event);
    doc.addEventListener('keydown', listener);
    return () => {
      if (typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('keydown', listener);
      }
    };
  }

  function has(id) {
    return findEntry(id) !== null;
  }

  function hasLayer(layer) {
    if (!LAYER_PRIORITY.has(layer)) return false;
    return buckets.get(layer).length > 0;
  }

  function list() {
    const out = [];
    for (const layer of LAYER_ORDER) {
      const items = buckets.get(layer);
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const { id, origin, meta } = items[i];
        out.push({ id, layer, origin, meta });
      }
    }
    return out;
  }

  function size() {
    let total = 0;
    for (const items of buckets.values()) total += items.length;
    return total;
  }

  function clear(layer = null) {
    if (layer !== null) {
      if (!LAYER_PRIORITY.has(layer)) {
        throw new TypeError(`Unknown back-stack layer: ${String(layer)}`);
      }
      buckets.get(layer).length = 0;
      changed();
      return;
    }
    for (const items of buckets.values()) items.length = 0;
    changed();
  }

  /** Calls `fn()` after every change to the stack; → the function that stops it. */
  function watch(fn) {
    watchers.add(fn);
    return () => watchers.delete(fn);
  }

  return {
    push,
    remove,
    pop,
    back: pop,
    top,
    has,
    hasLayer,
    list,
    size,
    clear,
    handleKeydown,
    bindDocument,
    watch,
  };
}
