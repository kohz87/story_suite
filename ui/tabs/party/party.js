// Composes the Party tab: the row of member portraits with Invite, then the selected member's sheet.
import { h } from '../../kit/dom.js';
import { memberSheet } from './sheet.js';
import { portraitEl } from './slots.js';

const picked = new WeakMap();

function pick(party, ctx) {
  const id = picked.get(ctx.port ?? ctx);
  return party.members.find(m => m.id === id) ?? party.members.find(m => m.id === party.pcId) ?? party.members[0] ?? null;
}

function memberButton(member, active, onPick) {
  const hp = member.bars.find(b => b.kind === 'hp');
  return h(
    'button',
    { type: 'button', class: ['mb', member.away ? 'away' : null], dataset: { member: member.id }, 'aria-current': String(active), onClick: onPick },
    portraitEl(member, 'a'),
    member.name,
    member.away ? h('span', { class: 'aw', title: member.away.where }, member.away.short ?? 'away') : null,
    h('span', { class: 'hpl' }, h('b', { style: { width: `${hp && hp.max > 0 ? Math.round((hp.value / hp.max) * 100) : 0}%` } })),
  );
}

/** Builds the Party tab from a `party` view-model; ctx = { port, backStack, go }. Invite hides when the party is full. */
export function partyTab(party, ctx = {}) {
  const members = party?.members ?? [];
  const rootAttrs = { class: 'party-tab', dataset: { tab: 'party' } };
  const showInvite = Boolean(party?.canInvite) && members.length < (party?.max ?? 4);
  if (!members.length && !showInvite) return h('div', rootAttrs);
  const strip = h('div', { class: 'mem' });
  const invite = showInvite
    ? h('button', { type: 'button', class: 'inv', onClick: () => ctx.port?.command('party.invite', {}) }, '+ Invite')
    : null;
  const row = h('section', { class: 'card glass slim', dataset: { card: 'members' } }, h('div', { class: 'memrow' }, strip, invite));
  const sheetSlot = h('div', { class: 'psheet-slot' });

  function draw() {
    const current = pick(party, ctx);
    strip.replaceChildren(...members.map(m => memberButton(m, m === current, () => {
      picked.set(ctx.port ?? ctx, m.id);
      draw();
    })));
    sheetSlot.replaceChildren(...(current ? [memberSheet(current, ctx, { pc: current.id === party.pcId })] : []));
  }
  draw();
  return h('div', rootAttrs, row, sheetSlot);
}
