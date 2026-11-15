// Renders the Start section (scope, presets, module blocks with their feature switches) and the frame shared by every other section page.
import { h } from '../../kit/dom.js';
import { toggle, segmented } from '../../kit/controls.js';
import { renderGroups } from '../fields.js';

const t = (key, name, desc, tags = [], needs = null) => ({ key, name, desc, tags, needs });
const MODULES = [
  { id: 'rpg', name: 'RPG', icon: '⚔', sec: 'rpg', tok: 520, desc: 'Levels, stats, skills and gear; the Party tab, the bag’s load and fights (checks live in Director)', off: 'Story only: no levels, stats or fights; the Bag, Journal, checks and the clock still run.', subs: [t('fightBoard', 'Fight board', 'Choose each exchange on the board', ['merged']), t('gearInFights', 'Gear in fights', 'Worn gear adds to rolls and soak', ['merged']), t('partyLoad', 'Party load', 'Carrying limit and slowing down when over')] },
  { id: 'people', name: 'People', icon: '♥', sec: 'people', tok: 820, desc: 'Dossiers, feelings, moods and secrets of everyone you meet', off: 'No dossiers or feelings; the scene, the Bag, quests and the clock still run.', subs: [t('stages', 'Stages and milestones', 'Named stages that need feelings and a story milestone'), t('drift', 'Feelings drift each story day', 'Feelings ease back toward their resting value', [], 'clock'), t('presets', 'Meter presets and rules', 'Companion, Rival, Mentor and pack sets', ['cost:tokens']), t('socialChecks', 'Feelings add to social checks', 'Persuade or charm gets a bonus from how they feel', ['merged'], 'director.checks'), t('repeated', 'Repeated approaches give less', 'The same praise or gift loses force within a few days', [], 'clock'), t('mood', 'Mood and pull', 'Moods shift with drives and what happens'), t('notes', 'Dossier notes', 'What people know, lies they tell, their tastes', ['cost:tokens']), t('hidden', 'Hidden notes for new people', 'Secrets that open with trust or events; written inside the new-person fill-in call', ['cost:tokens']), t('ties', 'Ties map', 'Who is close to whom')] },
  { id: 'world', name: 'World and time', icon: '◍', sec: 'world', tok: 310, desc: 'Calendar, weather, map and travel. The story clock is core and always runs', off: 'The story clock, dates and deadlines still run; weather, the map, trips and the day digest stop.', subs: [t('weather', 'Weather', 'Rolled from the calendar and region', ['merged']), t('worldView', 'World view and map', 'The World tab: map, news, factions'), t('trips', 'Trips and travel', 'Routes, legs and arrivals at the party pace', [], 'clock'), t('digest', 'Day digest', 'One summary per story day for the Journal', [], 'clock')] },
  { id: 'director', name: 'Director', icon: '✎', sec: 'director', tok: 640, desc: 'Checks, the story’s plan and the world that moves off-screen', off: 'No checks, plan or off-screen cast; the clock, World and the Journal still run.', subs: [t('checks', 'Checks', 'The story asks for a roll; one owner for checks (also in Story-only chats)', ['merged']), t('rollBefore', 'Roll checks before the reply', 'When you try something risky the check is rolled first', ['cost:model call'], 'director.checks'), t('threads', 'World-building threads', 'Agendas, events, clocks, beats, secrets', ['cost:tokens']), t('arcPlanning', 'Arc planning', 'A planner suggests the next arc for you to accept', ['cost:model call'], 'director.threads'), t('cast', 'The cast', 'The pack’s people live off-screen', ['cost:model call'], 'clock'), t('pulse', 'World pulse', 'A small roll before each reply'), t('initiative', 'People take the initiative', 'Someone present acts on their own now and then', [], 'clock'), t('names', 'Names', 'Fresh names for new people')] },
  { id: 'extras', name: 'Chat extras', icon: '✦', sec: 'extras', tok: 180, desc: 'Small things around each reply', off: 'Replies read as plain text; the rest of the suite is unchanged.', subs: [t('choices', 'Choices', 'Suggested next actions under the reply'), t('chatter', 'Inner chatter', 'Thoughts of the people present'), t('yourLook', 'Your look', 'The story keeps your outfit and what you carry'), t('trackers', 'Trackers', 'Your custom blocks (Story › Trackers)')] },
];
const PRESETS = [
  ['lean', 'Lean', 'Inventory, money, place, people, quests and time. No world-building threads or travel.', '≈ 2,460'],
  ['standard', 'Standard', 'Today’s defaults.', '≈ 3,550'],
  ['full', 'Full', 'Standard plus choices, inner chatter and a check roll before each reply.', '≈ 3,650'],
];
const REMOVED = ['Save points and Return in time (restart from a message instead)', 'Pick what you take (the story writes what you find)', 'Key people (the ★ Follow star in People)', 'Mounts list (riding animals in Mount slots, carts and boats in Bag › Transport)', 'Tab placement (the tabs are fixed)', 'Status strip above the message box (the inline row under the reply)', 'People’s floating launcher buttons', 'Auto scan, Full scan every turn, Scan every (Refresh every N)', 'The People calendar (one calendar)', 'Source of truth switches (one store)'];
const STATES = new WeakMap();

/** Returns the shared editable copy of `ctx.settings.modules` ({ scope, preset, chat, newChats, open }), so Start and the module pages agree. */
export function moduleState(ctx) {
  const key = ctx.settings ?? ctx;
  if (!STATES.has(key)) {
    const m = ctx.settings?.modules ?? {};
    const copy = set => Object.fromEntries(Object.entries(set ?? {}).map(([id, v]) => [id, { on: Boolean(v.on), subs: { ...v.subs } }]));
    STATES.set(key, { scope: m.scope ?? 'chat', preset: m.preset ?? null, chat: copy(m.chat), newChats: copy(m.newChats), open: {} });
  }
  return STATES.get(key);
}

function needInfo(sub, state) {
  if (!sub.needs) return null;
  if (sub.needs === 'clock') return { ok: true, text: 'needs the story clock' };
  const [id, key] = sub.needs.split('.');
  const label = MODULES.find(m => m.id === id)?.subs.find(s => s.key === key)?.name ?? id;
  return { ok: Boolean(state.chat[id]?.on && state.chat[id].subs[key]), text: `needs ${label}` };
}

function tagEl(tag) {
  const [kind, text] = tag.split(':');
  return h('span', { class: ['tg2', kind] }, text ?? kind);
}

/** Builds one module block; opts = { scope, open, page, onChanged(), onOpen(), onGo(id) }. Repaints itself unless onChanged is given. */
export function renderModule(meta, ctx, opts = {}) {
  const state = moduleState(ctx);
  const scope = opts.scope ?? 'chat';
  const set = state[scope][meta.id];
  const el = h('div', { class: 'mod', dataset: { mod: meta.id } });
  const emit = (path, value) => {
    state.preset = null;
    ctx.onChange?.(`modules.${scope}.${meta.id}.${path}`, value, null);
    if (opts.onChanged) opts.onChanged(); else fill();
  };
  function fill() {
    const subs = meta.subs.filter(s => s.key in set.subs);
    const onCount = subs.filter(s => set.subs[s.key]).length;
    el.className = set.on ? 'mod' : 'mod off';
    const rows = subs.map((s) => {
      const need = needInfo(s, state);
      return h('div', { class: ['srow', 'swrow', 'sub', !set.on && 'dis'] },
        h('span', { class: 'lb' }, h('b', s.name, s.tags.map(tagEl)),
          h('small', s.desc, need ? [' · ', h('span', { class: need.ok ? 'needok' : 'needbad' }, need.text, need.ok ? '' : ' (off)')] : null)),
        h('span', { class: 'ctl' }, toggle({ checked: set.subs[s.key], label: s.name, disabled: !set.on, dataset: { sub: `${meta.id}:${s.key}` }, onChange: v => { set.subs[s.key] = v; emit(`subs.${s.key}`, v); } })));
    });
    const open = opts.page || opts.open;
    el.replaceChildren(
      h('div', { class: 'mh' }, h('span', { class: 'mi' }, meta.icon),
        h('span', { class: 'mt' }, h('b', meta.name), h('small', set.on ? meta.desc : meta.off)),
        h('span', { class: 'mc' }, set.on ? `${onCount} of ${subs.length} on · ≈ ${meta.tok} tokens` : 'off'),
        toggle({ checked: set.on, label: meta.name, dataset: { mod: meta.id }, onChange: v => { set.on = v; emit('on', v); } })),
      open ? h('div', { class: 'msubs' }, rows) : null,
      opts.page ? null : h('div', { class: 'mf' },
        h('button', { type: 'button', class: 'lnk', dataset: { modopen: meta.id }, onClick: () => opts.onOpen?.() }, open ? 'Hide features ▴' : 'Features ▾'),
        h('button', { type: 'button', class: 'lnk', dataset: { sec: meta.sec }, onClick: () => opts.onGo?.(meta.sec) }, 'Settings ›')),
    );
  }
  fill();
  return el;
}

function startBody(ctx, state, repaint) {
  const chat = state.scope === 'chat';
  const mods = MODULES.filter(m => state[state.scope][m.id]).map(m => renderModule(m, ctx, {
    scope: state.scope, open: state.open[m.id], onChanged: repaint, onGo: id => ctx.go?.(id),
    onOpen: () => { state.open[m.id] = !state.open[m.id]; repaint(); },
  }));
  return [
    h('div', { class: 'scope' }, h('span', 'Modules and features for'),
      segmented({ items: [['chat', 'This chat'], ['newChats', 'New chats']], value: state.scope, label: 'Scope', className: 'sseg2', onChange: (v) => { state.scope = v; ctx.onChange?.('modules.scope', v, null); repaint(); } }),
      h('small', chat ? 'Only this chat changes. New chats start from the New chats set; a branched chat keeps its parent’s set.' : 'The starting set for every new chat; existing chats keep their own.')),
    state.preset ? null : h('div', { class: 'custom' }, 'Custom · your switches differ from the presets'),
    h('div', { class: 'presets' }, PRESETS.map(([id, name, desc, tok]) => h('button', { type: 'button', class: 'pre', dataset: { pre: id }, 'aria-pressed': String(state.preset === id), onClick: () => { state.preset = id; ctx.onChange?.('modules.preset', id, null); repaint(); } },
      h('b', name), h('small', desc), h('em', `${tok} tokens of rules each reply`)))),
    h('p', { class: 'fine', style: 'margin:-6px 0 0' }, 'Change any switch below and this shows Custom. Turning something off never deletes your story.'),
    h('p', { class: 'fine extnote', style: 'margin:0' }, 'This window opens from SillyTavern’s Extensions menu (the Story Suite entry) and from the ⚙ on the suite view.'),
    h('div', { class: 'mods' }, mods),
    h('button', { type: 'button', class: 'btn2', style: 'align-self:flex-start', onClick: () => { state.preset = 'standard'; ctx.onAction?.('reset.start', 'Reset to Standard', null); repaint(); } }, 'Reset to Standard'),
    h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Gone (decided)'), h('ul', { class: 'removed' }, REMOVED.map(r => h('li', r))), h('div', { style: 'height:8px' })),
  ];
}

/** Renders the Start section body: scope switch, presets, the five module blocks, the removed list. Returns an array holding one wrapper. */
export function renderStartSection(section, ctx) {
  const state = moduleState(ctx);
  const wrap = h('div', { class: 'sstart', style: 'display:flex;flex-direction:column;gap:14px' });
  const repaint = () => wrap.replaceChildren(...startBody(ctx, state, repaint));
  repaint();
  return [wrap];
}

/** Builds a section page body: the applies note, the module block (opts.module), opts.before nodes, the row groups, opts.after nodes, and a Reset button. */
export function sectionFrame(section, ctx, opts = {}) {
  const meta = MODULES.find(m => m.id === opts.module);
  const hasBlock = meta && moduleState(ctx).chat[meta.id];
  return [
    h('p', { class: 'applies' }, hasBlock ? 'The switches below are for this chat (set new-chat defaults in Start). ' : '', 'Settings apply to all chats, except those marked ', h('span', { class: 'tg2 chat' }, 'this chat'), '.'),
    hasBlock ? h('div', { class: 'mods' }, renderModule(meta, ctx, { page: true })) : null,
    ...(opts.before ?? []),
    ...renderGroups(section.rows, ctx),
    ...(opts.after ?? []),
    (section.rows ?? []).length
      ? h('button', { type: 'button', class: 'btn2', style: 'align-self:flex-start', onClick: () => ctx.onAction?.(`reset.${section.id}`, 'Reset', section) }, `Reset ${section.name} to defaults`)
      : null,
  ].filter(Boolean);
}
