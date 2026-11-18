// Wraps Story Block's sdk as the UI port: views come from injected selectors fed by sdk queries, actions pass through, and nothing throws.

import { peopleCommand } from './people-settings.js';
import { packPresets } from '../select/people-settings/catalog.js';
import { modelsCommand } from './models.js';
import { rpgCommand } from './rpg.js';
import { moneyCommand } from './money.js';
import { toolsCommand } from './tools.js';
import { promptsCommand } from './prompts.js';
import { peopleExportCommand } from './people-export.js';
import { trackerCommand } from './trackers.js';
import { worldCommand } from './world-settings.js';
import { directorCommand } from './settings-director.js';
import { extrasCommand } from './extras.js';
import { packsCommand } from './packs.js';
import { hostCommand } from './host-settings.js';
import { resetCommand } from './resets.js';
import { moduleCardCommand } from './module-cards.js';
import { ALIAS_NAMES, aliasCommand } from './aliases.js';
import { OWN_NAMES } from './own-names.js';
import { exportCommand } from './party-export.js';
import { focusCommand } from './focus.js';
import { refreshCommand } from './people-refresh.js';
import { portraitCommand } from './people-portrait.js';
import { manageCommand } from './people-manage.js';
import { dataCommand, isDataKey } from './people-data.js';
import { autoCapped } from './auto-fight.js';
import { arcController } from '../../modules/arc/controller.js';

/** The page event `port.open` sends when the view's own opener does not open the window (nothing in Story Suite answers it since the old view went; a window no one answers is "not available"). */
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
  auto: p => (p?.stance ? [p.id, p.n, p.stance] : [p?.id, p?.n]),
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

/** Creates the port: `writes` is `{ settings.set, features.set }`, the host's stores (the public sdk has none); `tools` is the engine's read-only Tools handle (the Tools page's report and rebuild); `selectors` maps a tab to `(read) → view-model`; `prefs` is `{ device, chat }` stores; `onError(tab, error)` hears a selector that threw (the view stays null); `reread(index)` is the sdk's; `rpgValues()` reads Story Block’s settings bucket (the RPG page’s Custom start); `packs` is the Packs page's handle ({ packs, readLorebook, lore }); `offer()` gives the card-offer controller (or null) that `packs.offer` and the `offer` event reach; `hold` is the waiting fight's handle (port/hold.js) that `interaction.choose` answers; `screens.open(id, payload, { onEnd })` is the view's own opener (ui/wizard/attach.js): true when it opened the window or a refusal for a window it owns, and then no page event is sent; false sends it. */
export function createSbPort({ sdk, writes = null, tools = null, selectors = {}, prefs = null, onError = null, offer = null, rpgValues = () => null, packs = null, hold = null, screens = null, arc = arcController } = {}) {
  const read = makeReader(sdk);
  const heard = new Set();
  // The engine does not announce an interaction change (it writes chat metadata only): the port does, after each call, so the view redraws.
  const announce = (answer) => { for (const fn of [...heard]) { try { fn(answer); } catch { /* a broken listener must not break the call */ } } };
  const interact = async (verb, payload) => {
    const call = sdk?.interaction?.[verb];
    if (typeof call !== 'function') return { ...FAILED, message: 'The engine has no interactions.' };
    let answer;
    try {
      answer = verb === 'auto' && payload?.cap === true ? autoCapped(sdk.interaction, payload, rpgValues()) : await call.apply(sdk.interaction, INTERACTION[verb](payload)); // (cap: the board's Auto plays up to the setting)
    } catch (error) {
      answer = failure(error);
    }
    // A fight that was started from the standing-foes offer and is discarded gives that offer back (the reply it was opened on is the first part of the session id).
    if (verb === 'discard' && answer?.discarded === true && typeof answer.id === 'string') { try { hold?.choose?.('restore', { origin: answer.id.split(':').slice(0, -2).join(':') }); } catch { /* the offer comes back with the next chat change */ } }
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
    // Whether a control that sends `type` can work: the port answers it itself, or a registered module has the command. The view hides a control that cannot.
    can(type) {
      if (typeof type !== 'string') return false;
      if (OWN_NAMES.includes(type) || ALIAS_NAMES.includes(type) || type.startsWith('tracker.') || type.startsWith('interaction.')) return true;
      try { return (sdk?.modules?.() ?? []).some((def) => Array.isArray(def?.commands) && def.commands.includes(type)); } catch { return false; }
    },
    async command(type, payload, options) {
      // The Models page's pick and test (port/models.js) are answered here; every other command goes to the sdk.
      if (type === 'settings.set' || type === 'settings.action') {
        let answer = null;
        try { answer = await modelsCommand(sdk, type, payload, Date.now, writes); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        answer = rpgCommand(type, payload, writes, rpgValues);
        if (answer) return answer;
        try { answer = directorCommand(type, payload, writes, prefs?.chat); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        answer = moneyCommand(type, payload, writes);
        if (answer) return answer;
        try { answer = promptsCommand(type, payload, writes) ?? await peopleExportCommand(type, payload); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = await toolsCommand(tools, type, payload); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        // Settings › Tools › NPC State data: the three data dialogs (backup, restore, diagnostics).
        if (type === 'settings.action' && isDataKey(payload?.key)) return dataCommand(payload.key);
        try { answer = peopleCommand(type, payload, writes, () => sdk?.settings?.('npc-state-delta') ?? {}, () => packPresets(sdk)); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = await worldCommand(type, payload, writes); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = extrasCommand(type, payload, writes); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = await packsCommand(packs, sdk, type, payload); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = hostCommand(type, payload, writes); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = resetCommand(type, payload, writes, () => sdk?.features?.()); } catch (error) { answer = failure(error); }
        if (answer) return answer;
        try { answer = moduleCardCommand(type, payload, writes, () => sdk?.features?.()); } catch (error) { answer = failure(error); }
        if (answer) return answer;
      }
      if (typeof type === 'string' && type.startsWith('tracker.')) {
        const answer = await trackerCommand(sdk, type, payload).catch(failure);
        if (answer) { announce(answer); return answer; }
      }
      if (ALIAS_NAMES.includes(type)) { const answer = await aliasCommand(sdk, type, payload).catch(failure); announce(answer); return answer; }
      // Export asks the RPG for the member's saved file and gives it back; the sheet saves it.
      if (type === 'party.export') return exportCommand(sdk, payload);
      if (type === 'packs.offer') return offerCommand(offer?.(), payload);
      if (type === 'quest.focus') { const answer = focusCommand(prefs?.chat, payload); announce(answer); return answer; }
      // The dossier's Refresh re-reads the story with NPC State's Refresh (the engine's `npc.refresh` only works the stages out again).
      if (type === 'npc.refresh' && payload?.name !== undefined) return refreshCommand(payload);
      // The dossier's Portrait opens NPC State's portrait manager (a page dialog, nothing recorded).
      if (type === 'npc.portrait') return portraitCommand(payload);
      // Edit, Delete and Mark alive go to NPC State's own editor and dossier tools the same way.
      if (type === 'npc.edit' || type === 'npc.delete' || type === 'npc.markAlive' || type === 'npc.add') return manageCommand(type, payload);
      // The waiting fight's answers (board, auto, plain, send, discard): the pause's own, so the old view and this one write the same; the view redraws after.
      if (type === 'interaction.choose') {
        let answer = hold ? null : { ...FAILED, message: 'No fight is waiting.' };
        try { answer ??= hold.choose(String(payload?.choice ?? '')); } catch (error) { answer = failure(error); }
        if (answer?.ok && answer.view?.error) answer = { ...FAILED, message: String(answer.view.error) };
        announce(answer);
        return answer;
      }
      if (typeof type === 'string' && type.startsWith('interaction.')) {
        const verb = type.slice('interaction.'.length);
        return Object.hasOwn(INTERACTION, verb) ? interact(verb, payload) : Promise.resolve({ ...FAILED, message: `The engine does not take ${type}.` });
      }
      return guarded(sdk, 'command', type, payload, options);
    },
    // Opens a window (the New character window, filled in from `payload`): the view's own opener first, else the `story-suite:open` page event; no engine command, nothing recorded.
    async open(id, payload, { onEnd } = {}) {
      let own = false;
      try { own = screens?.open?.(id, payload ?? null, { onEnd: typeof onEnd === 'function' ? onEnd : null }) ?? false; } catch (error) { own = failure(error); }
      if (own === true) return { ok: true };
      if (own && typeof own === 'object') return own;
      const doc = globalThis.document;
      if (typeof doc?.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return { ...FAILED, message: 'There is no page to open it on.' };
      const detail = { id, payload: payload ?? null, handled: false, onEnd: typeof onEnd === 'function' ? onEnd : null };
      doc.dispatchEvent(new globalThis.CustomEvent(OPEN_EVENT, { detail }));
      return detail.handled ? { ok: true } : { ...FAILED, message: 'That window is not available now.' };
    },
    preview: (type, payload) => guarded(sdk, 'preview', type, payload),
    commit: token => guarded(sdk, 'commit', token),
    reread: (index, options) => guarded(sdk, 'reread', index, options),
    on(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('port.on listener must be a function');
      if (event === 'offer') { const off = offer?.()?.subscribe?.(fn); return typeof off === 'function' ? off : () => {}; }
      // (the waiting fight changes outside the engine too: the hold's own word redraws the view as an interaction call does)
      if (event === 'interaction') { heard.add(fn); const off = hold?.subscribe?.(() => fn(null)); return () => { heard.delete(fn); off?.(); }; }
      // The arc planner works on its own too (automatic planning, "Planning…"): its word redraws the story view as a call does.
      if (event === 'arc') { let off = null; try { off = arc().subscribe(() => fn(null)); } catch { off = null; } return typeof off === 'function' ? off : () => {}; }
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
