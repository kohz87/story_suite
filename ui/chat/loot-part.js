// Builds the head reply's loot under the inline row: a "Loot" chip that folds the reply's pick-what-you-take chips open and shut.
import { h } from '../kit/dom.js';
import { lootPick, lootDraft } from '../kit/loot-pick.js';

/**
 * The reply's loot (the inline row's `loot`, LOOT_OFFER_SHAPE offers) → { chip, panel }; both null when the reply laid none out.
 * An offer not taken yet starts open, as the reply's card shows it; a taken one starts folded. The fold outlives a redraw (lootDraft).
 */
export function lootPart(loot, on = {}) {
  const offers = Array.isArray(loot) ? loot.filter(offer => offer?.items?.length) : [];
  if (!offers.length) return { chip: null, panel: null };
  const waiting = offers.filter(offer => !offer.taken);
  const things = waiting.reduce((sum, offer) => sum + offer.items.length, 0);
  const draft = lootDraft(offers[0].sid);
  const open = draft.open ?? waiting.length > 0;
  const panel = h('div', { class: 'sslootp', hidden: !open },
    offers.map(offer => lootPick(offer, { look: 'row', onTake: (sid, pick) => on.onLootTake?.(sid, pick) })));
  const label = waiting.length ? `Loot to pick up, ${things} thing${things === 1 ? '' : 's'}` : 'Loot, taken';
  const chip = h(
    'button',
    {
      type: 'button', class: 'ssbtn', dataset: { loot: '1' }, 'aria-expanded': String(open), 'aria-label': label, title: label,
      onClick: () => {
        const now = panel.hasAttribute('hidden');
        if (now) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
        chip.setAttribute('aria-expanded', String(now));
        draft.open = now;
      },
    },
    h('span', { class: 'lb' }, 'Loot '),
    h('span', { class: 'n' }, waiting.length ? String(things) : '✓'),
  );
  return { chip, panel };
}
