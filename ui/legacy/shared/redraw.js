// generated from ui/runtime/redraw.js; do not edit.
// Coalesces change events into one frame and redraws only changed sections.

const PORT_EVENTS = ['head', 'committed', 'turn', 'feature', 'offer'];

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return 'Date:' + JSON.stringify(value.toISOString());
  }
  if (value instanceof Map) {
    const entries = Array.from(value.entries())
      .map(([k, v]) => [stableStringify(k), stableStringify(v)])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k, v]) => '[' + k + ',' + v + ']');
    return 'Map:[' + entries.join(',') + ']';
  }
  if (value instanceof Set) {
    const values = Array.from(value.values()).map(stableStringify).sort();
    return 'Set:[' + values.join(',') + ']';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function defaultSchedule(fn) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(fn);
  }
  return queueMicrotask(fn);
}

function extractKeys(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.keys)) return payload.keys;
  return null;
}

function keysMatch(sectionKeys, changedKeys) {
  if (!changedKeys || changedKeys.size === 0) return true;
  if (!sectionKeys || sectionKeys.length === 0) return true;
  if (sectionKeys.includes('*')) return true;
  return sectionKeys.some(k => changedKeys.has(k));
}

function swapChildren(target, built) {
  if (built === undefined) return;
  const nodes = Array.isArray(built) ? built : [built];
  target.replaceChildren(...nodes.filter(Boolean));
}

/** Creates a frame-coalescing redraw scheduler bound to an optional port. */
export function createRedraw({ port = null, schedule = defaultSchedule, initialTab = null } = {}) {
  const sections = new Map();
  const lastDigest = new Map();
  const dirtyIds = new Set();
  const staleIds = new Set();
  const unsubs = [];

  let activeTab = initialTab;
  let holds = 0;
  let scheduled = false;
  let destroyed = false;

  function isVisible(entry) {
    if (typeof entry.isVisible === 'function') return Boolean(entry.isVisible());
    if (!entry.tab || entry.tab === 'always' || entry.tab === 'chat') return true;
    return entry.tab === activeTab;
  }

  function requestFlush() {
    if (destroyed || holds > 0 || scheduled || dirtyIds.size === 0) return;
    scheduled = true;
    schedule(() => {
      if (!destroyed) flush();
    });
  }

  function markSectionDirty(id, entry, keySet) {
    if (!keysMatch(entry.keys, keySet)) return;
    if (isVisible(entry)) {
      dirtyIds.add(id);
      staleIds.delete(id);
    } else {
      staleIds.add(id);
    }
  }

  function markDirty(keys = null) {
    if (destroyed) return;
    const keySet = keys ? new Set(keys) : null;
    for (const [id, entry] of sections.entries()) {
      markSectionDirty(id, entry, keySet);
    }
    requestFlush();
  }

  function changed(keys) {
    markDirty(Array.isArray(keys) ? keys : []);
  }

  function setVisibleTab(tab) {
    if (destroyed || tab === activeTab) return;
    activeTab = tab;
    for (const [id, entry] of sections.entries()) {
      if (isVisible(entry) && (staleIds.has(id) || !lastDigest.has(id))) {
        dirtyIds.add(id);
        staleIds.delete(id);
      }
    }
    requestFlush();
  }

  function register(id, section) {
    if (!id || typeof id !== 'string') {
      throw new TypeError('Section id must be a non-empty string');
    }
    const entry = {
      tab: section.tab ?? null,
      keys: Array.isArray(section.keys) ? [...section.keys] : null,
      isVisible: section.isVisible ?? null,
      read: section.read ?? null,
      render: section.render ?? null,
      draw: section.draw ?? null,
      target: section.target ?? null,
    };
    sections.set(id, entry);
    let seeded = false;
    if (section.drawn === true) {
      // Already on screen: remember what it shows, draw nothing until it changes.
      // A read() that throws seeds nothing: the section is then drawn like any other new one, and register does not throw.
      try {
        lastDigest.set(id, stableStringify(entry.read ? entry.read() : undefined));
        dirtyIds.delete(id);
        staleIds.delete(id);
        seeded = true;
      } catch {
        lastDigest.delete(id);
      }
    }
    if (!seeded) {
      if (isVisible(entry)) dirtyIds.add(id);
      else staleIds.add(id);
    }
    return () => unregister(id);
  }

  function unregister(id) {
    sections.delete(id);
    lastDigest.delete(id);
    dirtyIds.delete(id);
    staleIds.delete(id);
  }

  function drawEntry(id, entry) {
    const vm = entry.read ? entry.read() : undefined;
    const digest = stableStringify(vm);
    if (lastDigest.has(id) && lastDigest.get(id) === digest) {
      return 'skipped';
    }
    if (entry.render && entry.target) {
      swapChildren(entry.target, entry.render(vm));
    } else if (entry.draw) {
      entry.draw(vm);
    } else if (entry.render) {
      entry.render(vm);
    }
    lastDigest.set(id, digest);
    return 'drawn';
  }

  // `force` (flushNow) draws even while a hold is open: the hold stays open and what it covers is drawn again only if it changes.
  function flush(force = false) {
    scheduled = false;
    if (destroyed || (holds > 0 && force !== true)) {
      return { drawn: [], skipped: [], failed: [] };
    }

    const toProcess = Array.from(dirtyIds);
    dirtyIds.clear();

    const drawn = [];
    const skipped = [];
    const failed = [];

    for (const id of toProcess) {
      const entry = sections.get(id);
      if (!entry) continue;
      if (!isVisible(entry)) {
        staleIds.add(id);
        continue;
      }
      try {
        const outcome = drawEntry(id, entry);
        if (outcome === 'skipped') skipped.push(id);
        else drawn.push(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ id, message });
      }
    }

    return { drawn, skipped, failed };
  }

  function hold() {
    holds += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds = Math.max(0, holds - 1);
      if (holds === 0 && dirtyIds.size > 0) {
        requestFlush();
      }
    };
  }

  function pending() {
    return Array.from(dirtyIds).sort();
  }

  function destroy() {
    destroyed = true;
    for (const unsub of unsubs) {
      if (typeof unsub === 'function') unsub();
    }
    unsubs.length = 0;
    sections.clear();
    lastDigest.clear();
    dirtyIds.clear();
    staleIds.clear();
  }

  if (port && typeof port.on === 'function') {
    for (const event of PORT_EVENTS) {
      const unsub = port.on(event, () => markDirty());
      if (typeof unsub === 'function') unsubs.push(unsub);
    }
    const unsubChanged = port.on('changed', payload => {
      const keys = extractKeys(payload);
      markDirty(keys);
    });
    if (typeof unsubChanged === 'function') unsubs.push(unsubChanged);
  }

  return {
    register,
    unregister,
    setVisibleTab,
    markDirty,
    changed,
    flush: () => flush(),
    flushNow: () => flush(true),
    hold,
    pending,
    destroy,
  };
}
