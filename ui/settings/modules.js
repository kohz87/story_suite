// Renders the Start page's module area: the scope switch, the three presets and the module cards with their features.
import { h } from '../kit/dom.js';
import { toggle, segmented } from '../kit/controls.js';
import { tagNodes } from './fields.js';

function needsOk(sub, defs, set) {
  if (!sub.needs || sub.needs.startsWith('the story clock')) return true;
  for (const def of defs) {
    const target = def.subs.find(x => sub.needs.startsWith(x.label));
    if (target) return Boolean(set[def.id]?.on && set[def.id].subs[target.key]);
  }
  return true;
}

function featureRow(def, sub, state) {
  const { set, defs, change } = state;
  const ok = needsOk(sub, defs, set);
  const on = set[def.id].on;
  const sw = toggle({ checked: set[def.id].subs[sub.key], label: sub.label, disabled: !on, onChange: v => change(def.id, sub.key, v) });
  const needs = sub.needs ? [' · ', h('span', { class: ok ? 'needok' : 'needbad' }, `needs ${sub.needs}${ok ? '' : ' (off)'}`)] : null;
  const row = h('div', { class: ['srow', 'swrow', 'sub', !on && 'dis'] },
    h('span', { class: 'lb' }, h('b', sub.label, tagNodes(sub.tags)), h('small', sub.hint, needs)), h('span', { class: 'ctl' }, sw));
  row.addEventListener('click', (e) => { if (!e.target.closest('button')) sw.click(); });
  return row;
}

function moduleCard(def, state, open, withLinks) {
  const { set, change, toggleOpen, go } = state;
  const on = set[def.id].on;
  const count = def.subs.filter(x => set[def.id].subs[x.key]).length;
  const head = h('div', { class: 'mh' }, h('span', { class: 'mi', 'aria-hidden': 'true' }, def.icon),
    h('span', { class: 'mt' }, h('b', def.name), h('small', on ? def.desc : def.off)),
    h('span', { class: 'mc' }, on ? `${count} of ${def.subs.length} on · ≈ ${def.tokens} tokens` : 'off'),
    toggle({ checked: on, label: def.name, onChange: v => change(def.id, null, v) }));
  const links = withLinks ? h('div', { class: 'mf' },
    h('button', { type: 'button', class: 'lnk', onClick: () => toggleOpen(def.id) }, `${open ? 'Hide features' : 'Features'} ${open ? '▴' : '▾'}`),
    h('button', { type: 'button', class: 'lnk', onClick: () => go(def.section) }, 'Settings ›')) : null;
  const subs = open ? h('div', { class: 'msubs' }, def.subs.map(sub => featureRow(def, sub, state))) : null;
  return h('div', { class: ['mod', !on && 'off'] }, head, subs, links);
}

/** Builds one module card (`withLinks` false: no Features / Settings links, features always shown) for a section page. */
export function renderModuleCard(def, state, withLinks = false) {
  return h('div', { class: 'mods' }, moduleCard(def, state, !withLinks || Boolean(state.openMods[def.id]), withLinks));
}

/** Builds the Start page body: scope switch, presets, notes and the module cards. state = { modules, scope, setScope, preset(), setPreset, ...card state }. */
export function renderStart(state) {
  const { modules, scope, setScope, setPreset, openMods } = state;
  const chatScope = scope === 'chat';
  const preset = modules.preset;
  const scopeCard = h('div', { class: 'scope' }, h('span', 'Modules and features for'),
    segmented({ items: [['chat', 'This chat · Ersveil'], ['newChats', 'New chats']], value: scope, label: 'Modules and features for', className: 'sseg2', onChange: setScope }),
    h('small', chatScope
      ? 'Only this chat changes. New chats start from the New chats set; a branched chat keeps its parent’s set.'
      : 'The starting set for every new chat; existing chats keep their own (an existing chat with no set of its own keeps today’s switches).'));
  const presets = h('div', { class: 'presets' }, modules.presets.map(p => h('button', { type: 'button', class: 'pre', 'aria-pressed': String(preset === p.id), onClick: () => setPreset(p.id) },
    h('b', p.name), h('small', p.desc), h('em', `≈ ${p.tokens.toLocaleString('en-US')} tokens of rules each reply`))));
  return [
    scopeCard,
    preset ? null : h('div', { class: 'custom' }, 'Custom · your switches differ from the presets'),
    presets,
    h('p', { class: 'fine', style: { margin: '-6px 0 0' } }, 'Change any switch below and this shows Custom. Turning something off never deletes your story.'),
    h('p', { class: 'fine extnote', style: { margin: '0' } }, 'This window opens from SillyTavern’s Extensions menu (the Story Suite entry) and from the ⚙ on the suite view.'),
    h('div', { class: 'mods' }, modules.defs.map(def => moduleCard(def, state, Boolean(openMods[def.id]), true))),
  ];
}
