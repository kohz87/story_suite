// Words for when something in a dossier happened: "reply #6, Oct 1" in a line, and the date over "reply #6" in a dated row's left column (from stored records only).
import { h } from '../../../kit/dom.js';

const known = reply => Number.isInteger(reply) && reply >= 0;

/** "reply #6, Oct 1", "reply #6" or "Oct 1" from a reply (message index) and a story date text; '' when neither is known (never guessed). */
export function replyWhen(reply, date) {
  return [known(reply) ? `reply #${reply}` : null, date || null].filter(Boolean).join(', ');
}

/** One dated row (.ev): the left column has the date in bold over "reply #N" (each only when known), the right column the given content. */
export function eventRow(reply, date, ...content) {
  return h('div', { class: 'ev' },
    h('span', { class: 'w' }, date ? h('b', null, date) : null, known(reply) ? `reply #${reply}` : null),
    h('p', null, ...content));
}
