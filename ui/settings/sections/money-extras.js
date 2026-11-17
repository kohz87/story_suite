// Renders the two small Rules pages, Money (coins and prices) and Chat extras (its module switches and inner chatter).
import { h } from '../../kit/dom.js';
import { readCoins } from '../../select/money-lines.js';
import { sectionFrame } from './start.js';

// Names a coin line that does not read under the Coins row, as the old page did; the text is not saved until it reads.
function watchCoins(nodes) {
  const note = h('p', { class: 'fine', role: 'alert' });
  note.hidden = true;
  const input = nodes.flatMap(n => [...(n.querySelectorAll?.('[data-key="money.coins"] input') ?? [])])[0];
  input?.addEventListener('change', () => {
    const read = readCoins(input.value);
    note.textContent = read.ok ? '' : read.message;
    note.hidden = read.ok;
  });
  return note;
}

/** Returns the Money page nodes for `section`. */
export function renderMoneySection(section, ctx) {
  const body = sectionFrame(section, ctx);
  return [...body, watchCoins(body)];
}

/** Returns the Chat extras page nodes for `section`, headed by its module switches. */
export function renderExtrasSection(section, ctx) {
  return sectionFrame(section, ctx);
}
