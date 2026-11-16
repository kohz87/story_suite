// Builds the Foes card: foe groups by tier with member health, a one-line fold per group, and target buttons while picking.
import { h } from '../../kit/dom.js';

const oddsClass = word => String(word ?? '').replace(/\s+/g, '');
const standing = group => group.members.filter(m => m.hp > 0);

function countText(groups) {
  const all = groups.flatMap(g => g.members);
  const down = all.filter(m => m.hp <= 0).length;
  return `${all.length} · ${down === 0 ? 'none down' : down === all.length ? 'all down' : `${down} down`}`;
}

function foldLine(group) {
  const hp = group.members.reduce((sum, m) => sum + Math.max(0, m.hp), 0);
  const max = group.members.reduce((sum, m) => sum + m.max, 0) || 1;
  return h(
    'div',
    { class: 'fline' },
    h('b', null, group.name),
    group.tier ? h('span', { class: ['tier', group.tier] }, group.tier) : null,
    h('span', { class: 'fstand' }, `${standing(group).length} of ${group.members.length} up`),
    h('span', { class: 'hb' }, h('b', { style: { width: `${Math.round((hp / max) * 100)}%` } })),
  );
}

function memberButton(member, group, pick, onPick) {
  const down = member.hp <= 0;
  const can = pick === 'member' && !down;
  const word = group.odds?.word ?? null;
  return h(
    'button',
    {
      type: 'button',
      class: ['mbx', down ? 'down' : null, can ? 'tgt' : null],
      disabled: !can,
      'aria-label': `${member.name}: ${down ? 'down' : `${member.hp} of ${member.max} health`}${can && word ? `, ${word}` : ''}`,
      dataset: can ? { target: member.id } : null,
      onClick: can ? () => onPick?.({ kind: 'member', id: member.id, arg: member.arg }) : null,
    },
    h('span', { class: 'mn' }, member.name, h('small', null, down ? 'down' : `${member.hp}/${member.max}`)),
    can && word ? h('span', { class: ['todds', oddsClass(word)] }, word) : null,
    h('span', { class: 'hb' }, h('b', { style: { width: `${Math.round((Math.max(0, member.hp) / (member.max || 1)) * 100)}%` } })),
  );
}

function groupBlock(group, pick, onPick) {
  const aim = pick === 'group' && standing(group).length > 0;
  const head = h(
    'div',
    { class: 'h' },
    h('b', null, group.members.length > 1 ? `${group.name} ×${group.members.length}` : group.name),
    h('span', { class: 'tier' }, `Lv ${group.lv}`),
    group.tier ? h('span', { class: ['tier', group.tier] }, group.tier) : null,
    aim && group.odds?.word ? h('span', { class: ['todds', oddsClass(group.odds.word)] }, `${group.odds.word} each`) : null,
  );
  const attrs = aim
    ? { role: 'button', tabindex: '0', dataset: { target: group.name }, onClick: () => onPick?.({ kind: 'group', id: group.id ?? group.name, arg: group.arg }),
        onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') onPick?.({ kind: 'group', id: group.id ?? group.name, arg: group.arg }); } }
    : {};
  return h('div', { class: ['fg', aim ? 'tgt' : null], ...attrs }, head,
    h('div', { class: 'fm2' }, group.members.map(m => memberButton(m, group, pick, onPick))));
}

/** Builds the Foes card from `foeGroups`; `pick` is null, 'member' or 'group'; `onPick({ kind, id })` fires on a target tap. */
export function foesCard(groups = [], { pick = null, onPick } = {}) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  return h(
    'section',
    { class: 'card glass cpt foes-card', 'aria-label': 'Foes', dataset: { card: 'foes', pick } },
    h('div', { class: 'ch' }, h('h3', null, 'Foes'), h('span', { class: 'cnt' }, countText(groups))),
    pick ? null : h('div', { class: 'fold-view' }, groups.map(foldLine)),
    h('div', { class: 'foes full-view' }, groups.map(g => groupBlock(g, pick, onPick))),
  );
}
