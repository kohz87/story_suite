// The tabs under each reply (Changes, Chatter, Here, Choices): their order and which show, read from and written to Story Block's `replyTabs` text.

/** The four tabs in their default order. */
export const TAB_IDS = Object.freeze(['changes', 'chatter', 'here', 'choices']);
/** Each tab's label, and the note the Settings panel shows beside it. */
export const TAB_TEXT = Object.freeze({
  changes: Object.freeze({ label: 'Changes', note: '' }),
  chatter: Object.freeze({ label: 'Chatter', note: 'needs Inner chatter on' }),
  here: Object.freeze({ label: 'Here', note: '' }),
  choices: Object.freeze({ label: 'Choices', note: 'rests open on the newest reply' }),
});

/**
 * The stored text ("changes chatter -here choices": the order, a "-" before a hidden one) → [{ id, on }] for all four tabs: an unknown or
 * repeated word is dropped, a missing tab is added in its default place at the end (shown). Anything not text gives the default.
 */
export function readTabOrder(value) {
  const out = [];
  for (const word of String(typeof value === 'string' ? value : '').toLowerCase().split(/[\s,]+/)) {
    const off = word.startsWith('-');
    const id = off ? word.slice(1) : word;
    if (TAB_IDS.includes(id) && !out.some(row => row.id === id)) out.push({ id, on: !off });
  }
  for (const id of TAB_IDS) if (!out.some(row => row.id === id)) out.push({ id, on: true });
  return out;
}

/** [{ id, on }] → the stored text (read back through readTabOrder, so the list is always whole). */
export function writeTabOrder(list) {
  return readTabOrder((Array.isArray(list) ? list : []).map(row => `${row?.on === false ? '-' : ''}${String(row?.id ?? '')}`).join(' ')).map(row => `${row.on ? '' : '-'}${row.id}`).join(' ');
}
