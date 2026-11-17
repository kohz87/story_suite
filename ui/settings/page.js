// Composes one Settings section page: heading, the "applies to" note, the module card, the special body, the setting cards and the reset buttons.
import { h } from '../kit/dom.js';
import { renderGroups } from './fields.js';
import { renderStart, renderModuleCard } from './modules.js';
import { renderConnections } from './connections.js';
import { renderPacks } from './packs.js';
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
  let developer = settings.developer === true;
  const redraw = () => ctx.repaint();
  const toolsBody = createToolsPage(settings, ctx, { on: () => developer, own: { onChange: (key, value) => { developer = Boolean(value); ctx.onChange?.(key, value); }, repaint: redraw } });

  const cardState = () => ({
    modules, chat, defs: modules.defs, set: modules[modules.scope], scope: modules.scope, openMods, go: ctx.go,
    change(id, key, value) {
      const m = modules[modules.scope][id];
      if (key === null) m.on = value; else { m.subs[key] = value; modules.preset = null; }
      ctx.onChange?.(`modules.${modules.scope}.${id}${key === null ? '' : `.${key}`}`, value);
      redraw();
    },
    toggleOpen(id) { openMods[id] = !openMods[id]; redraw(); },
    setScope(scope) { modules.scope = scope; redraw(); },
    setPreset(id) { modules.preset = id; ctx.onAction?.('modules.preset', id); redraw(); },
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

  function special(section) {
    if (section.special === 'start') return renderStart(cardState());
    if (section.special === 'models') {
      return renderConnections({ connections, tested, failed, test: testConnection, pick: (id, value) => { tested.delete(id); failed.delete(id); const c = connections.find(x => x.id === id); if (c) c.value = value; ctx.onChange?.(`models.${id}`, value); redraw(); } });
    }
    if (section.special === 'packs') {
      return renderPacks({
        packs, confirming, setConfirm(on) { confirming = on; redraw(); },
        change: (name, on) => ctx.onChange?.(`packs.${name}`, on), act: (key, name) => ctx.onAction?.(key, name),
      });
    }
    if (section.special === 'tools') return toolsBody();
    return [];
  }

  const reset = (label, key) => h('button', { type: 'button', class: 'btn2', style: { 'align-self': 'flex-start' }, onClick: () => ctx.onAction?.(key, label) }, label);

  /** The section's own body: its module card, the special area (Start, Models, Packs, Tools) and the setting cards. */
  function body(section) {
    const def = modules.defs.find(m => m.section === section.id);
    return [def && renderModuleCard(def, cardState(), false), ...special(section), ...renderGroups(section.rows, ctx)].filter(Boolean);
  }

  function page(section, custom) {
    const def = modules.defs.find(m => m.section === section.id);
    const isStart = section.id === 'start';
    const applies = isStart ? null : h('p', { class: 'applies' }, def ? 'The switches below are for this chat (set new-chat defaults in Start). ' : '',
      'Settings apply to all chats, except those marked ', h('span', { class: 'tg2 chat' }, 'this chat'), '.');
    const content = custom == null ? body(section) : [custom].flat();
    const tail = [];
    if (!isStart && section.rows.length) tail.push(reset(`Reset ${section.name} to defaults`, 'settings.reset'));
    if (isStart) {
      tail.push(reset('Reset to Standard', 'modules.reset'),
        h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Gone (decided)'), h('ul', { class: 'removed' }, (settings.removed ?? []).map(r => h('li', r))), h('div', { style: { height: '8px' } })));
    }
    return [h('div', h('h2', section.name), h('p', { class: 'sdesc' }, section.desc), applies), ...content.filter(Boolean), ...tail];
  }

  return { page, body };
}
