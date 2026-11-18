// Builds one loot offer's picker: its things as chips to tick, the "Take selected" button and the answer line; the ticks outlive a redraw.
import { h } from './dom.js';

// The reader's ticks, the fold and the last refusal per offer (by its reply's sid): the chat row and the Bag are drawn again on every
// engine event, so what the reader is doing lives here, not in the elements. A take that went through forgets its offer.
const drafts = new Map();

/** The draft of offer `sid`: { picks: Set<at>, open: boolean|null, error: string }, made on first use. */
export function lootDraft(sid) {
  if (!drafts.has(sid)) drafts.set(sid, { picks: new Set(), open: null, error: '' });
  return drafts.get(sid);
}

const LOOK = {
  // the chat row: SillyTavern's theme (the row's own chips); the Bag: the suite's chips and buttons
  row: { chips: 'lpchips', chip: 'ssbtn lpchip', take: 'ssbtn lptake' },
  bag: { chips: 'chips3 lpchips', chip: 'lpchip', take: 'btn2 pri lptake' },
};

/**
 * Builds the picker of a LOOT_OFFER_SHAPE offer; `onTake(sid, pick)` sends `inventory.lootTake` and answers its result (a refusal's
 * message is shown under the button). look: 'row' (under a reply) or 'bag' (the Bag's To pick up). A taken offer says so and nothing more.
 */
export function lootPick(offer, { onTake, look = 'row' } = {}) {
  const css = LOOK[look] ?? LOOK.row;
  const head = h('div', { class: 'lphead' }, h('b', null, 'Loot'), offer.where ? h('span', { class: 'where' }, ` — ${offer.where}`) : null);
  if (offer.taken) return h('div', { class: ['lootpk', 'taken'], dataset: { lootSid: offer.sid } }, head, h('p', { class: 'lpnote' }, 'Taken.'));
  const draft = lootDraft(offer.sid);
  for (const at of [...draft.picks]) if (!offer.items.some(item => item.at === at)) draft.picks.delete(at);
  const said = h('p', { class: 'lperr', role: 'alert' }, draft.error);
  const setOff = off => (off ? take.setAttribute('disabled', '') : take.removeAttribute('disabled'));
  const take = h('button', {
    type: 'button', class: css.take, title: 'Put the things you ticked in the party’s bag', disabled: draft.picks.size === 0,
    onClick: async () => {
      if (!draft.picks.size || take.hasAttribute('disabled')) return;
      setOff(true);
      let result = null;
      try { result = await onTake?.(offer.sid, [...draft.picks].sort((a, b) => a - b)); } catch (error) { result = { ok: false, message: String(error?.message ?? error) }; }
      if (result && result.ok === false) {
        draft.error = String(result.message || 'That could not be taken.');
        said.textContent = draft.error;
        setOff(draft.picks.size === 0);
        return;
      }
      drafts.delete(offer.sid);
    },
  }, 'Take selected');
  const chips = offer.items.map(item => {
    const chip = h('button', {
      type: 'button', class: css.chip, 'aria-pressed': String(draft.picks.has(item.at)), dataset: { at: String(item.at) },
      onClick: () => {
        if (draft.picks.has(item.at)) draft.picks.delete(item.at); else draft.picks.add(item.at);
        chip.setAttribute('aria-pressed', String(draft.picks.has(item.at)));
        setOff(draft.picks.size === 0);
      },
    }, item.label);
    return chip;
  });
  return h(
    'div',
    { class: ['lootpk', look], dataset: { lootSid: offer.sid } },
    head,
    h('div', { class: css.chips }, chips),
    h('p', { class: 'lpnote' }, 'Tick what to take, then Take selected. The loot is taken once: what you leave stays behind.'),
    h('div', { class: 'lpact' }, take),
    said,
  );
}
