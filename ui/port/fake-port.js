// Fake engine port that serves fixture view-models, records commands, and emits events on demand.

import { fixture } from '../fixtures/index.js';

export function createFakePort(options = {}) {
  let currentViews = options.views ? structuredClone(options.views) : fixture(options.variant ?? 'default');
  const listeners = new Map();
  const log = [];
  let seq = 0;

  function cloneOrNull(value) {
    return value === undefined ? null : structuredClone(value);
  }

  function record(entry) {
    seq += 1;
    const item = { seq, ...entry };
    log.push(item);
    return item;
  }

  return {
    view(tab) {
      if (typeof tab !== 'string' || !Object.hasOwn(currentViews, tab)) return null;
      return structuredClone(currentViews[tab]);
    },

    async command(type, payload, cmdOptions) {
      const entry = record({
        kind: 'command',
        type,
        payload: cloneOrNull(payload),
        options: cloneOrNull(cmdOptions),
      });
      return { ok: true, type, seq: entry.seq };
    },

    async preview(type, payload) {
      const entry = record({
        kind: 'preview',
        type,
        payload: cloneOrNull(payload),
      });
      const token = `fake-preview-${entry.seq}`;
      return { ok: true, type, token, seq: entry.seq };
    },

    async commit(token) {
      const entry = record({ kind: 'commit', token });
      return { ok: true, token, seq: entry.seq };
    },

    on(event, fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('port.on listener must be a function');
      }
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(fn);
      return () => {
        set.delete(fn);
        if (set.size === 0) listeners.delete(event);
      };
    },

    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return 0;
      let count = 0;
      for (const fn of [...set]) {
        fn(payload);
        count += 1;
      }
      return count;
    },

    setVariant(variant, { notify = false } = {}) {
      currentViews = fixture(variant);
      if (notify) this.emit('head', { variant });
    },

    get recorded() {
      return log.slice();
    },

    clearRecorded() {
      log.length = 0;
    },
  };
}
