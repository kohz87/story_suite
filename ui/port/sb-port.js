// Wraps Story Block's sdk as the UI port: views come from injected selectors fed by sdk queries, actions pass through, and nothing throws.

import { peopleCommand } from './people-settings.js';
import { modelsCommand } from './models.js';
import { toolsCommand } from './tools.js';
import { trackerCommand } from './trackers.js';

/** The page event `port.open` sends and the host answers (ui/legacy/ui-host/lean-rpg-sync.js). */
export const OPEN_EVENT = 'story-suite:open';
const FAILED = Object.freeze({ ok: false, code: 'FAILED', message: 'The engine could not do that.' });

function failure(error) {
  return { ...FAILED, message: String(error?.message || FAILED.message) };
}

/** Builds `read(name, args)`: an sdk query whose failure or missing answer comes back as null (a gap the UI hides). */
export function makeReader(sdk) {
  return (name, args) => {
    try {
      const answer = sdk?.query?.(name, args);
      return answer === undefined ? null : answer;
    } catch {
      return null;
    }
  };
}

async function guarded(sdk, method, ...args) {
  if (typeof sdk?.[method] !== 'function') return { ...FAILED, message: `The engine has no ${method}.` };
  try {
    return await sdk[method](...args);
  } catch (error) {
    return failure(error);
  }
}

// `command('interaction.<verb>', payload)` is `sdk.interaction.<verb>(...)`; only these verbs (never `settle`, which is the core's own).
const INTERACTION = {
  open: p => [p?.kindId, p?.args],
  stage: p => [p?.id, p?.step],
  auto: p => [p?.id, p?.n],
  send: p => [p?.id],
  discard: p => [p?.id],
};

// The card offer's three answers, the same calls the old panel makes: Install or Update (with the "Also apply" tick), Not now, Dismiss.
async function offerCommand(controller, payload) {
  if (!controller) return { ...FAILED, message: 'No card offer is open.' };
  const id = String(payload?.id ?? '');
  try {
    if (payload?.op === 'install') { const done = await controller.install(id, { settings: payload.settings === true }); return done ? { ok: done.ok, message: done.text } : { ...FAILED, message: 'That offer cannot be installed now.' }; }
    if (payload?.op === 'notNow') { controller.notNow(id); return { ok: true }; }
    if (payload?.op === 'dismiss') { controller.dismiss(id); return { ok: true }; }
  } catch (error) { return failure(error); }
  return { ...FAILED, message: 'The engine does not take that offer answer.' };
}

/** Creates the port: `writes` is `{ settings.set, features.set }`, the host's stores (the public sdk has none); `tools` is the engine's read-only Tools handle (the Tools page's report and rebuild); `selectors` maps a tab to `(read) → view-model`; `prefs` is `{ device, chat }` stores; `onError(tab, error)` hears a selector that threw (the view stays null); `reread(index)` is the sdk's; `offer()` gives the card-offer controller (or null) that `packs.offer` and the `offer` event reach. */
export function createSbPort({ sdk, writes = null, tools = null, selectors = {}, prefs = null, onError = null, offer = null } = {}) {
  const read = makeReader(sdk);
  const heard = new Set();
  // The engine does not announce an interaction change (it writes chat metadata only): the port does, after each call, so the view redraws.
  const announce = (answer) => { for (const fn of [...heard]) { try { fn(answer); } catch { /* a broken listener must not break the call */ } } };
  const interact = async (verb, payload) => {
    const call = sdk?.interaction?.[verb];
    if (typeof call !== 'function') return { ...FAILED, message: 'The engine has no interactions.' };
    let answer;
    try {
      answer = await call.apply(sdk.interaction, INTERACTION[verb](payload));
    } catch (error) {
      answer = failure(error);
    }
    announce(answer);
    return answer;
  };
  const port = {
    view(tab, args) {
      const select = Object.hasOwn(selectors, tab) ? selectors[tab] : null;
      if (typeof select !== 'function') return null;
      try {
        const vm = select(read, args);
        return vm === undefined ? null : vm;
      } catch (error) {
        try { onError?.(tab, error); } catch { /* a broken listener must not break the view */ }
        return null;
      }
    },
    async command(type, payload, options) {
      // The Models page's pick and test (port/models.js) are answered here; every other command goes to the sdk.
      if (type === 'settings.set' || type === 'settings.action') {
        let answer = null;
        try { answer = await modelsCommand(sdk, type, payload, Date.now, writes); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = await toolsCommand(tools, type, payload); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = peopleCommand(type, payload, writes, () => sdk?.settings?.('npc-state-delta') ?? {}); } catch (error) { answer = failure(error); }
        if (answer) return answer;
      }
      if (typeof type === 'string' && type.startsWith('tracker.')) {
        const answer = await trackerCommand(sdk, type, payload).catch(failure);
        if (answer) { announce(answer); return answer; }
      }
      if (type === 'packs.offer') return offerCommand(offer?.(), payload);
      if (typeof type === 'string' && type.startsWith('interaction.')) {
        const verb = type.slice('interaction.'.length);
        return Object.hasOwn(INTERACTION, verb) ? interact(verb, payload) : Promise.resolve({ ...FAILED, message: `The engine does not take ${type}.` });
      }
      return guarded(sdk, 'command', type, payload, options);
    },
    // Opens a screen the host owns (the New character window, filled in from `payload`): the host answers the `story-suite:open` event on the page; no engine command, nothing recorded.
    async open(id, payload, { onEnd } = {}) {
      const doc = globalThis.document;
      if (typeof doc?.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return { ...FAILED, message: 'There is no page to open it on.' };
      const detail = { id, payload: payload ?? null, handled: false, onEnd: typeof onEnd === 'function' ? onEnd : null };
      doc.dispatchEvent(new globalThis.CustomEvent(OPEN_EVENT, { detail }));
      return detail.handled ? { ok: true } : { ...FAILED, message: 'That window is not available now.' };
    },
    preview: (type, payload) => guarded(sdk, 'preview', type, payload),
    commit: token => guarded(sdk, 'commit', token),
    reread: index => guarded(sdk, 'reread', index),
    on(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('port.on listener must be a function');
      if (event === 'offer') { const off = offer?.()?.subscribe?.(fn); return typeof off === 'function' ? off : () => {}; }
      if (event === 'interaction') { heard.add(fn); return () => heard.delete(fn); }
      let off = null;
      try {
        off = sdk?.on?.(event, fn);
      } catch {
        off = null; // an event this Story Block build does not have (for example `changed`): nothing to listen to
      }
      return typeof off === 'function' ? off : () => {};
    },
  };
  if (prefs) {
    const device = prefs.device;
    const chat = prefs.chat;
    port.prefs = {
      getDevice: () => device?.get?.() ?? {},
      setDevice: (key, value) => device?.set?.(key, value),
      getChat: () => chat?.get?.() ?? {},
      setChat: (_chatId, level, value) => chat?.set?.(level, value),
    };
  }
  return port;
}
