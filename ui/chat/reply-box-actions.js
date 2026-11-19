// Builds the action line at the bottom of the newest reply's card: a fight open, loot to pick up, points to spend, overdue items, a companion
// asking to join, pack offers waiting and "No changes recorded — Re-read"; each runs the same command the chips and Needs you ran before.
import { h } from '../kit/dom.js';
import { lootPick, lootDraft } from '../kit/loot-pick.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function act(label, onClick, extra = {}) {
  return h('button', { type: 'button', class: ['ab', extra.hot ? 'hot' : null], title: extra.title ?? null, dataset: extra.dataset ?? null, 'aria-expanded': extra.expanded ?? null, onClick },
    h('span', { class: 'lb' }, label), h('span', { class: 'ar', 'aria-hidden': 'true' }, '›'));
}

// "Pick up: rat tails ×12, torn grain sack ›" folds the reply's loot picker open and shut (the fold outlives a redraw: lootDraft).
function lootParts(loot, on) {
  const waiting = (Array.isArray(loot) ? loot : []).filter(offer => !offer.taken && offer.items?.length);
  if (!waiting.length) return { button: null, panel: null };
  const draft = lootDraft(waiting[0].sid);
  const open = draft.open === true;
  const panel = h('div', { class: 'sslootp', hidden: !open }, waiting.map(offer => lootPick(offer, { look: 'row', onTake: (sid, pick) => on.onLootTake?.(sid, pick) })));
  const names = waiting.flatMap(offer => offer.items.map(item => item.label)).join(', ');
  const button = act(`Pick up: ${names}`, () => {
    const now = panel.hasAttribute('hidden');
    if (now) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    button.setAttribute('aria-expanded', String(now));
    draft.open = now;
  }, { dataset: { loot: '1' }, expanded: String(open), title: 'Pick what you take' });
  return { button, panel };
}

/**
 * The action line of `actions` (the chat view's head.actions) → the `.ssrc-acts` element, or null when there is nothing to do.
 * Handlers: onFight, onLootTake(sid, pick), onPoints, onOverdue, onJoin(name|null), onOffers, onReread (the badge is a button only with it).
 */
export function replyBoxActions(actions, on = {}) {
  const a = actions || {};
  const loot = lootParts(a.loot, on);
  const joins = Array.isArray(a.joins) ? a.joins : [];
  const items = [
    a.fight ? act('⚔ Fight open', () => on.onFight?.(), { hot: true, title: 'Open the Fight tab' }) : null,
    loot.button,
    a.points?.n > 0 ? act(`${plural(a.points.n, 'point', 'points')} to spend`, () => on.onPoints?.(), { title: a.points.who.join(', ') || null }) : null,
    a.overdue?.n > 0 ? act(`${a.overdue.n} overdue`, () => on.onOverdue?.(), { title: a.overdue.names.join(', ') || null }) : null,
    joins.length ? act(joins.length === 1 ? `${joins[0]} asks to join` : `${joins.length} ask to join`, () => on.onJoin?.(joins.length === 1 ? joins[0] : null), { title: 'Add to party or No, on their page' }) : null,
    a.offers > 0 ? act(plural(a.offers, 'pack offer', 'pack offers'), () => on.onOffers?.()) : null,
  ].filter(Boolean);
  if (a.unrecorded === true) {
    const title = 'The reply came with no change block, so nothing in it was kept. Add its lines to the reply, then Re-read.';
    const inside = [h('span', { class: 'bang', 'aria-hidden': 'true' }, '!'), h('span', { class: 'lb' }, `No changes recorded${on.onReread ? ' — Re-read' : ''}`)];
    items.push(on.onReread
      ? h('button', { type: 'button', class: 'ab need', title, dataset: { unrecorded: '1' }, onClick: () => on.onReread() }, inside)
      : h('span', { class: 'ab need', role: 'note', title, dataset: { unrecorded: '1' } }, inside));
  }
  if (!items.length) return null;
  return h('div', { class: 'ssrc-acts', dataset: { ssActions: '1' } }, h('div', { class: 'row' }, items), loot.panel);
}
