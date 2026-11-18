// The Bag purse's "this turn" list: the coin lines of the head reply's changes (reply.changes), worded in the chat's currency.

import { money } from './money.js';

/** `reply.changes` answer + `inventory.currency` → [{ line, delta, up, earlier }], one per coin line ("+3 silver"); [] when the reply moved no coin. */
export function purseLines(changes, currency) {
  const lines = Array.isArray(changes?.lines) ? changes.lines : [];
  return lines.filter(row => row?.glyph === 'coin' && typeof row.line === 'string').flatMap(row => {
    const up = row.line.startsWith('+');
    const amount = Number(row.line.replace(/^[+−-]/u, ''));
    return Number.isSafeInteger(amount) && amount > 0 ? [{ line: row.assist === true ? '(assist)' : '', delta: `${up ? '+' : '−'}${money(amount, currency)}`, up, earlier: false }] : [];
  });
}
