// The party lines of `reply.changes`: who joined, came back or left, and who reached a new level in a won fight (read from the receipts' own data).

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');

/** True for a receipt that carries a join record (`data.join`) or a won fight's awards (`data.v2.result.fight`). */
export const isPartyReceipt = receipt => isRec(receipt?.data?.join) || Array.isArray(receipt?.data?.v2?.result?.fight?.awards);

const fold = value => text(value).normalize('NFKC').toLowerCase();
// The name of a Character block the state holds: its `who` field, else the block's own name ('' when it is not there).
function blockName(state, module) {
    const domain = state?.domains?.dataModules;
    const who = text(domain?.instances?.[module]?.chat?.fields?.who);
    return who || text(domain?.pins?.[domain?.active?.[module]?.hash]?.definition?.name);
}
// A block the reader made by hand (a `ui` `dm.define`): the name of the Character it defined in `state`, '' for any other receipt.
const madeBy = (receipt, state) => (receipt?.cause === 'ui' && receipt?.type === 'dm.define' ? blockName(state, receipt?.data?.v2?.result?.module) : '');

/**
 * The reader's own (`ui`) receipts of a reply (`all`, every receipt of it) that are still its party changes: the join card's Add to party or bench choice (a join
 * record), and a block the reader made by hand only when it is the Character an offer on the same reply names (the card's Edit first then Create).
 */
export function readerJoins(all, state = null) {
  const offered = new Set(all.filter(receipt => receipt?.data?.join?.op === 'offer').map(receipt => fold(receipt.data.join.name)).filter(Boolean));
  return all.filter(receipt => receipt?.cause === 'ui' && (isRec(receipt?.data?.join) || offered.has(fold(madeBy(receipt, state)))));
}

const JOINS = { added: 'joined the party', back: 'is back in the party', left: 'left the party' };

/**
 * Receipts → [{ glyph, line, detail, applied }]: "Pell joined the party", "Astra reached Lv 3 (+1 point)". A Character the reader made by hand (`dm.define`) is "joined"
 * when an offer on the reply (`join.op` 'offer') names it, read by its name in `state` (the card's Edit first: the wizard makes the blocks itself).
 */
export function partyLines(receipts, state = null) {
  const lines = [], told = new Set();
  const offered = new Set(receipts.filter(receipt => receipt.data?.join?.op === 'offer').map(receipt => fold(receipt.data.join.name)).filter(Boolean));
  for (const receipt of receipts) {
    const join = receipt.data?.join;
    if (isRec(join) && JOINS[join.op] && text(join.name)) { lines.push({ glyph: 'people', line: `${text(join.name)} ${JOINS[join.op]}`, detail: null, applied: true }); told.add(fold(join.name)); }
    const made = madeBy(receipt, state);
    if (made && offered.has(fold(made)) && !told.has(fold(made))) { lines.push({ glyph: 'people', line: `${made} ${JOINS.added}`, detail: null, applied: true }); told.add(fold(made)); }
    const awards = receipt.data?.v2?.result?.fight?.awards;
    for (const award of Array.isArray(awards) ? awards : []) {
      const up = award?.up;
      if (!isRec(up) || !Number.isSafeInteger(up.to) || !text(award.who)) continue;
      const points = Number.isSafeInteger(up.points) && up.points > 0 ? ` (+${up.points} point${up.points === 1 ? '' : 's'})` : '';
      lines.push({ glyph: 'up', line: `${text(award.who)} reached Lv ${up.to}${points}`, detail: null, applied: true });
    }
  }
  return lines;
}
