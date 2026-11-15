// Renders the Packs and trackers section: installed packs (with a Remove confirmation), data modules and the chat's trackers.
import { h } from '../../kit/dom.js';
import { toggle } from '../../kit/controls.js';
import { sectionFrame } from './start.js';

const btn = (label, onClick, cls = '') => h('button', { type: 'button', class: ['btn2', cls], onClick }, label);

function packsCard(packs, ctx, repaint, state) {
  const rows = packs.packs.flatMap((p) => {
    const row = h('div', { class: 'srow', dataset: { pack: p.id } },
      h('span', { class: 'lb' }, h('b', p.name), h('small', p.summary)),
      h('span', { class: 'ctl' },
        toggle({ checked: p.on, label: p.name, onChange: v => ctx.onChange?.(`packs.${p.id}.on`, v, null) }),
        btn('Remove', () => { state.confirm = state.confirm === p.id ? null : p.id; repaint(); }, 'dng')));
    if (state.confirm !== p.id) return [row];
    return [row, h('div', { class: 'cfm' }, h('b', `Remove ${p.name.replace(/\s*[\d.]+$/, '').replace(/ \(.*\)$/, '')}?`),
      h('small', 'Its content leaves the game. Stories already told keep what they used from it.'),
      h('span', { class: 'ctl' }, btn('Remove', () => { state.confirm = null; ctx.onAction?.(`packs.${p.id}.remove`, 'Remove', null); repaint(); }, 'dng'),
        btn('Keep it', () => { state.confirm = null; repaint(); })))];
  });
  return h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Packs'), rows,
    h('div', { class: 'srow wide' }, h('span', { class: 'ctl' },
      btn('Import a pack file', () => ctx.onAction?.('packs.import', 'Import a pack file', null), 'pri'),
      btn('Read from the character’s lorebook', () => ctx.onAction?.('packs.lorebook', 'Read from the character’s lorebook', null)))));
}

function dataCard(mods, ctx) {
  return h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Data modules in this chat'), mods.map(m => h('div', { class: ['srow', 'swrow'] },
    h('span', { class: 'lb' }, h('b', m.name), h('small', m.desc)),
    h('span', { class: 'ctl' }, toggle({ checked: m.on, label: m.name, onChange: v => ctx.onChange?.(`dataModules.${m.id}.on`, v, null) })))));
}

function trackerCard(t, ctx) {
  const act = (key, label) => () => ctx.onAction?.(key, label, null);
  return h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, `Trackers in this chat · ${t.items.length} of ${t.max}`),
    t.items.map(i => h('div', { class: 'srow', dataset: { tracker: i.id } }, h('span', { class: 'lb' }, h('b', i.name), h('small', i.desc)),
      h('span', { class: 'ctl' }, btn('Edit fields', act(`trackers.${i.id}.edit`, 'Edit fields'))))),
    h('div', { class: 'srow wide' }, h('span', { class: 'ctl' }, btn('New tracker', act('trackers.new', 'New tracker'), 'pri'),
      btn('From a template', act('trackers.template', 'From a template')), btn('Build it in the chat', act('trackers.chat', 'Build it in the chat')))));
}

/** Returns the Packs page nodes from `ctx.settings.packs` ({ packs, modules, trackers: { items, max } }); a missing list hides its card. */
export function renderPacksSection(section, ctx) {
  const data = ctx.settings?.packs ?? {};
  const state = { confirm: null };
  const wrap = h('div', { class: 'spacks', style: 'display:flex;flex-direction:column;gap:14px' });
  const repaint = () => wrap.replaceChildren(...[
    data.packs?.length ? packsCard(data, ctx, repaint, state) : null,
    data.modules?.length ? dataCard(data.modules, ctx) : null,
    data.trackers?.items ? trackerCard(data.trackers, ctx) : null,
  ].filter(Boolean));
  repaint();
  return sectionFrame(section, ctx, { before: [wrap] });
}
