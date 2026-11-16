// `compare --cards`: the replies whose recorded card text differs between two recordings (e.g. a flag off vs on).

/** → { replies: [{ reply, before, after }], missing: boolean } over the replies both records have; `missing` when a record has no card text at all. */
export function compareCards(a, b) {
  const cardsOf = record => new Map((Array.isArray(record?.replies) ? record.replies : []).map(reply => [reply?.index, reply?.card]));
  const left = cardsOf(a);
  const right = cardsOf(b);
  const hasAny = map => [...map.values()].some(card => typeof card === 'string');
  if (!hasAny(left) || !hasAny(right)) return { replies: [], missing: true };
  const replies = [];
  for (const index of [...new Set([...left.keys(), ...right.keys()])].sort((x, y) => x - y)) {
    const before = left.get(index);
    const after = right.get(index);
    if (before !== after) replies.push({ reply: index, before: before ?? null, after: after ?? null });
  }
  return { replies, missing: false };
}
