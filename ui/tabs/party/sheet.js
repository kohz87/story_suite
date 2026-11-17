// Builds one member's sheet (name, bars, doll, stats, skills) plus the stat-spend sheet and the ⋯ menu sheet.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { bars } from '../../kit/bars.js';
import { slotsDoll } from './slots.js';
import { skillsCard } from './skills.js';
import { openSheet } from './slot-picker.js';
import { can } from '../../runtime/can.js';

const STATS = ['STR', 'DEX', 'AGI', 'VIT', 'INT', 'WIS', 'CHA'];
const STAT_NAME = {
  STR: 'Strength', DEX: 'Dexterity', AGI: 'Agility', VIT: 'Vitality', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};
const POOL_STYLE = [['Health', 'hp'], ['Mana', 'mp'], ['Stamina', 'sp']];

// Combat Rules v1 pools, every term rounded down (the preview only; the engine stays the source of truth).
function pools(level, s) {
  return [
    5 + Math.floor(level / 3) + Math.floor(s.VIT / 2),
    8 + Math.floor(level / 4) + Math.floor((s.INT + s.WIS) / 4),
    8 + Math.floor(level / 4) + Math.floor((s.STR + s.AGI) / 4),
  ];
}

const plural = n => `${n} point${n === 1 ? '' : 's'}`;

/** Opens the stat sheet: + and − stage points, the preview shows the new pools, Save sends them. */
export function statSheet(member, ctx = {}) {
  const base = member.stats;
  const staged = { ...base };
  let left = member.points;
  const sheet = openSheet(ctx, { title: `${member.name} · Stats` });
  const save = async () => {
    await ctx.port?.command('rpg.stats.spend', { member: member.id, stats: { ...staged } });
    sheet.close();
  };

  function draw() {
    const changed = STATS.some(k => staged[k] !== base[k]);
    const before = pools(member.level, base);
    const after = pools(member.level, staged);
    sheet.subtitle(left ? `${plural(left)} to spend` : member.points ? 'All points placed' : 'No points to spend');
    const step = (k, sign) => () => {
      if (sign > 0 && left > 0) { staged[k] += 1; left -= 1; }
      if (sign < 0 && staged[k] > base[k]) { staged[k] -= 1; left += 1; }
      draw();
    };
    sheet.body.replaceChildren(
      h('div', null, STATS.map(k => h('div', { class: 'ps-st', dataset: { stat: k } },
        h('span', null, h('b', null, k), h('small', null, STAT_NAME[k])),
        h('span', { class: ['v', staged[k] > base[k] ? 'up' : null] }, staged[k]),
        h('button', { type: 'button', class: 'ps-b', dataset: { minus: k }, 'aria-label': `Lower ${k}`, disabled: staged[k] <= base[k], onClick: step(k, -1) }, '−'),
        h('button', { type: 'button', class: 'ps-b', dataset: { plus: k }, 'aria-label': `Raise ${k}`, disabled: left <= 0, onClick: step(k, 1) }, '+')))),
      h('div', { class: 'ps-sec' }, 'Preview · max'),
      h('div', { class: 'ps-pv' }, POOL_STYLE.map(([label, kind], j) => h('span', null, label,
        h('b', { class: after[j] > before[j] ? 'up' : null }, before[j] === after[j] ? before[j] : `${before[j]} → ${after[j]}`),
        h('i', null, h('b', { class: `fill ${kind}`, style: { width: `${Math.round((after[j] / (Math.max(before[j], after[j]) + 4)) * 100)}%` } }))))),
      h('div', { class: 'ps-row' },
        h('button', { type: 'button', class: 'ps-b', dataset: { reset: '1' }, disabled: !changed, onClick: () => { Object.assign(staged, base); left = member.points; draw(); } }, 'Reset'),
        h('button', { type: 'button', class: 'ps-b pri', dataset: { save: '1' }, disabled: !changed, onClick: save }, 'Save')),
    );
  }
  draw();
  return sheet;
}

/** Opens the ⋯ menu for a companion: Bench, Export, leaves the party (each sends one command). */
export function moreSheet(member, ctx = {}) {
  const sheet = openSheet(ctx, { title: member.name, subtitle: 'Party member' });
  const item = (label, type, danger) => h('button', {
    type: 'button',
    class: ['ps-b', danger ? 'bad' : null],
    dataset: { act: type },
    onClick: async () => { await ctx.port?.command(type, { member: member.id }); sheet.close(); },
  }, label);
  const items = [['party.bench', `Bench ${member.name}`], ['party.export', `Export ${member.name}`], ['party.leave', `${member.name} leaves the party`, true]]
    .filter(([type]) => can(ctx, type)).map(([type, label, danger]) => item(label, type, danger));
  sheet.body.replaceChildren(h('div', { class: 'ps-menu' }, ...items));
  return sheet;
}

const MORE = ['party.bench', 'party.export', 'party.leave'];

function head(member, ctx) {
  const effects = member.effects ?? [];
  return h(
    'div',
    { class: 'shead' },
    h('div', { class: 'shtop' }, h('div', { class: 'nm' }, member.name),
      MORE.some(type => can(ctx, type)) ? h('button', { type: 'button', class: 'ibtn', dataset: { more: '1' }, 'aria-label': `More for ${member.name}`, 'aria-haspopup': 'dialog', onClick: () => moreSheet(member, ctx) }, '⋯') : null),
    h('div', { class: 'chips' }, h('span', { class: 'lvl2' }, member.line),
      h('span', { class: 'chip2', title: `VIT ${member.stats.VIT}% + gear points` }, glyph('offhand'), `${member.soakPct}%`)),
    member.away ? h('div', { class: 'awn' }, `${member.away.where} · last seen ${member.away.lastSeen}. Still in the party: counts for load, pace and Use on…`) : null,
    effects.length ? h('div', { class: 'fx2' }, effects.map(e => h('span', { class: `f ${e.tone}`, dataset: { status: e.id } },
      h('span', { class: 'ic' }, glyph(e.tone === 'buff' ? 'stance' : 'warn')),
      h('span', { class: 'tx' }, h('b', null, e.label), e.note ? h('small', null, e.note) : null)))) : null,
  );
}

function statTiles(member, ctx) {
  const can = member.points > 0;
  return h('div', { class: 'st7' }, STATS.map(k => h('button', {
    type: 'button',
    class: ['sv', can ? 'can' : null],
    dataset: { stat: k },
    'aria-label': `${STAT_NAME[k]} ${member.stats[k]}`,
    onClick: () => statSheet(member, ctx),
  }, k, h('b', null, member.stats[k]))));
}

/** Builds one member's sheet; the player's own sheet skips the name, bars and XP (the card above has them). */
export function memberSheet(member, ctx = {}, { pc = false } = {}) {
  const left = [
    pc ? null : bars(member.bars),
    pc ? null : h('div', { class: 'xp2' }, h('span', null, 'XP'), h('i', null, h('b', { style: { width: `${member.xpPct}%` } })), h('span', null, `${member.xpPct}/100`)),
    h('div', { class: 'secl' }, 'Stats', member.points ? h('span', { class: 'pts' }, `${plural(member.points)} to spend`) : null),
    statTiles(member, ctx),
  ];
  return h(
    'section',
    { class: 'card glass psheet', dataset: { member: member.id } },
    pc ? null : head(member, ctx),
    h('div', { class: 'sgrid' }, slotsDoll(member, ctx), h('div', { class: 'lower' }, h('div', { class: 'lcol' }, left), skillsCard(member, ctx))),
  );
}
