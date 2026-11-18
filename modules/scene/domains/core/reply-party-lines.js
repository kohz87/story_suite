// The party lines of `reply.changes`: who joined, came back or left, and who reached a new level in a won fight (read from the receipts' own data).

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');

/** True for a receipt that carries a join record (`data.join`) or a won fight's awards (`data.v2.result.fight`). */
export const isPartyReceipt = receipt => isRec(receipt?.data?.join) || Array.isArray(receipt?.data?.v2?.result?.fight?.awards);

const JOINS = { added: 'joined the party', back: 'is back in the party', left: 'left the party' };

/** Receipts → [{ glyph, line, detail, applied }]: "Pell joined the party", "Astra reached Lv 3 (+1 point)". */
export function partyLines(receipts) {
  const lines = [];
  for (const receipt of receipts) {
    const join = receipt.data?.join;
    if (isRec(join) && JOINS[join.op] && text(join.name)) lines.push({ glyph: 'people', line: `${text(join.name)} ${JOINS[join.op]}`, detail: null, applied: true });
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
