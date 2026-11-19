// Composes one Settings section page: heading, the "applies to" note, the module card, the special body, the setting cards and the reset buttons.
import { h } from '../kit/dom.js';
import { renderGroups } from './fields.js';
import { renderStart, renderModuleCard } from './modules.js';
import { renderConnections } from './connections.js';
import { renderPacks } from './packs.js';
import { greyOut } from './off-grey.js';
import { createToolsPage } from './tools-page.js';

/**
 * Creates the page builder over a settings view-model. ctx = { onChange, onAction, go(id), repaint() }.
 * Keeps the local state the pages need (scope, opened module cards, tested connections, the pack-remove confirmation).
 * Returns `{ page(section, custom), body(section) }`: `custom` is the host's own body nodes for the section (or null for `body`), and the page keeps the heading, note and resets either way.
 */
export function createPages(settings, ctx) {
  const chat = /^this chat: (.+?) ·/.exec(settings.subtitle ?? '')?.[1] ?? null;
  const modules = structuredClone(settings.modules ?? { scope: 'chat', chat: {}, newChats: {}, preset: null, presets: [], defs: [] });
  const packs = structuredClone(settings.packs ?? { packs: [], modules: [], trackers: { cap: 0, items: [] } });
  const connections = settings.connections ?? [];
  const openMods = {};
  const tested = new Set();
  const failed = new Map();
  let confirming = false;
  let removing = '';   // the format 4 pack whose Remove question is open
  let keptFor = '';    // the world whose suggested game the reader kept their own over (Keep mine); asked again for another world
  let status = null;
  let lorebook = { confirming: '', use: {}, busy: '', result: null };   // a world pack's lorebook rows: the Update question, the ticks changed, the one being made, its result line
  let developer = settings.developer === true;
  const redraw = () => ctx.repaint();
  const toolsBody = createToolsPage(settings, ctx, { on: () => developer, own: { onChange: (key, value) => { developer = Boolean(value); ctx.onChange?.(key, value); }, repaint: redraw } });

  const cardState = () => ({
    modules, chat, defs: modules.defs, set: modules[modules.scope], scope: modules.scope, openMods, go: ctx.go, has: ctx.has,
    change(id, key, value) {
      const m = modules[modules.scope][id];
      if (key === null) m.on = value; else { m.subs[key] = value; modules.preset = null; }
      const answer = ctx.onChange?.(`modules.${modules.scope}.${id}${key === null ? '' : `.${key}`}`, value);
      if (typeof answer?.then === 'function') redraw();
      reread(answer);
    },
    toggleOpen(id) { openMods[id] = !openMods[id]; redraw(); },
    setScope(scope) { modules.scope = scope; redraw(); },
    setPreset(id) { modules.preset = id; run('modules.preset', id); },
  });

  // One tiny call on the card's connection. The host's answer ({ ok, seconds } or { ok: false, message }) is shown on the card;
  // a host that answers at once (or not at all) counts as answered.
  function testConnection(id) {
    tested.delete(id); failed.delete(id);
    const settle = answer => {
      if (answer?.ok === false) failed.set(id, String(answer.message ?? 'no answer'));
      else {
        tested.add(id);
        const c = connections.find(x => x.id === id);
        if (c && Number.isFinite(answer?.seconds)) c.testSeconds = answer.seconds;
      }
      redraw();
    };
    const answer = ctx.onAction?.('models.test', id);
    if (typeof answer?.then !== 'function') return settle(answer);
    answer.then(settle, error => { failed.set(id, String(error?.message ?? error)); redraw(); });
  }

  // A change or an action on the Packs page: the engine answers, then the page reads the packs again (the host's answer, or the snapshot when there is none) and draws.
  const readPacks = () => {
    const view = ctx.view?.('settings');
    const fresh = view?.packs;
    if (!fresh) return;
    packs.packs = fresh.packs; packs.modules = fresh.modules; packs.trackers = fresh.trackers;
    if (fresh.v4) packs.v4 = fresh.v4; else delete packs.v4;
    // The Start page's own rows say what the game in use gives (Blank: …), so a new pick changes them too.
    const mine = settings.sections?.find(item => item.id === 'start'), now = view.sections?.find(item => item.id === 'start');
    if (mine && now) mine.rows = now.rows;
  };
  const settle = answer => {
    if (typeof answer?.text === 'string') status = { text: answer.text, errors: answer.errors ?? [] };
    else if (answer?.ok === false) status = { text: String(answer.message ?? 'That did not work.'), errors: [] };
    readPacks();
    redraw();
  };
  const afterPacks = answer => (typeof answer?.then === 'function' ? answer.then(settle, error => settle({ ok: false, message: String(error?.message ?? error) })) : settle(answer));
  const packChange = (key, on) => afterPacks(ctx.onChange?.(key, on));
  const packAct = (key, value) => { status = null; return afterPacks(ctx.onAction?.(key, value)); };
  // Create or Update a world pack's lorebook (`packs.lorebook.make`): its result line goes under its row; a book to be replaced opens the Update question.
  const makeLorebook = value => {
    lorebook = { ...lorebook, busy: value.id, result: null };
    redraw();
    const done = answer => {
      const use = { ...lorebook.use };
      if (answer?.ok) delete use[value.id];
      lorebook = { ...lorebook, use, busy: '', confirming: answer?.confirm ? value.id : lorebook.confirming, result: answer?.confirm ? null : { id: value.id, text: String(answer?.text ?? answer?.message ?? 'That did not work.'), ok: answer?.ok === true } };
      readPacks();
      redraw();
    };
    const answer = ctx.onAction?.('packs.lorebook.make', value);
    return typeof answer?.then === 'function' ? answer.then(done, error => done({ ok: false, message: String(error?.message ?? error) })) : done(answer);
  };

  function special(section) {
    if (section.special === 'start') return renderStart(cardState());
    if (section.special === 'models') {
      return renderConnections({ connections, tested, failed, test: testConnection, pick: (id, value) => { tested.delete(id); failed.delete(id); const c = connections.find(x => x.id === id); if (c) c.value = value; ctx.onChange?.(`models.${id}`, value); redraw(); } });
    }
    if (section.special === 'packs') {
      const kept = Boolean(packs.v4?.world.value) && keptFor === packs.v4.world.value;
      return renderPacks({ packs, offers: ctx.view?.('now')?.offers ?? [], status, confirming, setConfirm(on) { confirming = on; redraw(); }, change: packChange, act: packAct, kept, setKept(on) { keptFor = on ? packs.v4.world.value : ''; redraw(); }, removing, setRemoving(id) { removing = id; redraw(); }, lorebook, setLorebook(patch) { lorebook = { ...lorebook, ...patch }; redraw(); }, makeLorebook });
    }
    if (section.special === 'tools') return toolsBody();
    return [];
  }

  // "Reset to Standard", a preset and a card switch change the switches in the store, so the open page reads them again (the host's answer: the switches, the preset, the cards' and presets' token figures) and draws at once; with no host answer it only draws.
  const readModules = () => { const fresh = ctx.view?.('settings')?.modules; if (fresh) { modules.chat = structuredClone(fresh.chat ?? modules.chat); modules.preset = fresh.preset ?? null; modules.defs = structuredClone(fresh.defs ?? modules.defs); modules.presets = structuredClone(fresh.presets ?? modules.presets); } };
  const afterReset = answer => { readModules(); redraw(); return answer; };
  const reread = answer => (typeof answer?.then === 'function' ? answer.then(afterReset, error => afterReset({ ok: false, message: String(error?.message ?? error) })) : afterReset(answer));
  const run = (key, label) => {
    const answer = ctx.onAction?.(key, label);
    return key === 'modules.reset' || key === 'modules.preset' ? reread(answer) : answer;
  };
  const reset = (label, key) => h('button', { type: 'button', class: 'btn2', style: { 'align-self': 'flex-start' }, onClick: () => run(key, label) }, label);

  /** The section's own body: its module card, the special area (Start, Models, Packs, Tools) and the setting cards. */
  function body(section) {
    const def = modules.defs.find(m => m.section === section.id);
    // (the Start page's own rows come after its Reset button: page() adds them)
    return [def && renderModuleCard(def, cardState(), false), ...special(section), ...(section.id === 'start' ? [] : renderGroups(section.rows, ctx))].filter(Boolean);
  }

  function page(section, custom) {
    const def = modules.defs.find(m => m.section === section.id);
    const isStart = section.id === 'start';
    const applies = isStart ? null : h('p', { class: 'applies' }, def ? (Object.keys(modules.newChats ?? {}).length ? 'The switches below are for this chat (set new-chat defaults in Start). ' : 'The switches below are the same in every chat. ') : '',
      'Settings apply to all chats, except those marked ', h('span', { class: 'tg2 chat' }, 'this chat'), '.');
    const drawn = (custom == null ? body(section) : [custom].flat()).filter(Boolean);
    const off = def && !isStart && modules[modules.scope]?.[def.id]?.on === false;
    const content = off ? greyOut(drawn, def.name) : drawn;
    const tail = [];
    if (!isStart && section.rows.some(r => r.type !== 'info' && r.type !== 'btn')) tail.push(reset(`Reset ${section.name} to defaults`, 'settings.reset'));
    if (isStart) {
      tail.push(reset('Reset to Standard', 'modules.reset'), ...renderGroups(section.rows, ctx));
      if ((settings.removed ?? []).length) tail.push(h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Gone (decided)'), h('ul', { class: 'removed' }, settings.removed.map(r => h('li', r))), h('div', { style: { height: '8px' } })));
    }
    return [h('div', h('h2', section.name), h('p', { class: 'sdesc' }, section.desc), applies), ...content.filter(Boolean), ...tail];
  }

  return { page, body };
}
