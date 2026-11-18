// Composes the Party tab: the row of member portraits with Invite, then the selected member's sheet.
import { h } from '../../kit/dom.js';
import { memberSheet } from './sheet.js';
import { portraitEl } from './slots.js';
import { can } from '../../runtime/can.js';

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

// "Create your character" (nobody yet) or "+ New character" (a party without You): shown while the story has no You (the view-model's
// `newCharacter`); it opens the New character window through the port (ui/wizard answers it). The old Party tab's words.
function newButton(first, ctx) {
  return h('button', { type: 'button', class: 'inv', dataset: { act: 'new-character' }, onClick: () => ctx.port?.open?.('story-block/new-character', null) },
    first ? 'Create your character' : '+ New character');
}

/** Builds the Party tab from a `party` view-model; ctx = { port, backStack, go }. Invite hides when the party is full. */
export function partyTab(party, ctx = {}) {
  const members = party?.members ?? [];
  const rootAttrs = { class: 'party-tab', dataset: { tab: 'party' } };
  const showInvite = Boolean(party?.canInvite) && members.length < (party?.max ?? 4) && can(ctx, 'party.invite');
  // (`characters`: the story's characters when the roster does not list them, Gear in fights off)
  const first = !members.length && !(party?.characters > 0);
  const create = party?.newCharacter === true ? newButton(first, ctx) : null;
  if (!members.length && !showInvite && !create) return h('div', rootAttrs);
  const strip = h('div', { class: 'mem' });
  const invite = showInvite
    ? h('button', { type: 'button', class: 'inv', onClick: () => ctx.port?.command('party.invite', {}) }, '+ Invite')
    : null;
  const row = h('section', { class: 'card glass slim', dataset: { card: 'members' } }, h('div', { class: 'memrow' }, strip, create, invite));
  const sheetSlot = h('div', { class: 'psheet-slot' });

  function draw() {
    const current = pick(party, ctx);
    strip.replaceChildren(...(first ? [h('span', { class: 'mem-empty' }, 'No characters yet.')] : []), ...members.map(m => memberButton(m, m === current, () => {
      picked.set(ctx.port ?? ctx, m.id);
      draw();
    })));
    sheetSlot.replaceChildren(...(current ? [memberSheet(current, ctx, { pc: current.id === party.pcId })] : []));
  }
  draw();
  return h('div', rootAttrs, row, sheetSlot);
}
