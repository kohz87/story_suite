// Builds the action line of the newest reply's card: a fight open, loot to pick up, points to spend, overdue items, a companion asking to join,
// pack offers waiting and the "no changes recorded" badge; each only while there is one.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');
const list = value => (Array.isArray(value) ? value : []);

/**
 * `answers`: the head's gathered answers (rpg.sheet, rpg.joinsOpen, time.overdue); `opts`: { fightOpen, loot (that reply's LOOT_OFFER_SHAPE offers),
 * offers (the pack offer rows), unrecorded }. → { fight, loot, points, overdue, joins, offers, unrecorded } (points and overdue null when none).
 */
export function selectReplyActions(answers = {}, opts = {}) {
  const owing = list(answers['rpg.sheet']).filter(row => isRec(row) && Number.isFinite(row.points) && row.points > 0);
  const points = owing.reduce((sum, row) => sum + row.points, 0);
  const overdue = list(answers['time.overdue']?.overdue);
  return {
    fight: opts.fightOpen === true,
    loot: list(opts.loot).filter(offer => offer?.items?.length),
    points: points > 0 ? { n: points, who: owing.map(row => text(row.name)).filter(Boolean) } : null,
    overdue: overdue.length ? { n: overdue.length, names: overdue.map(row => text(row?.key)).filter(Boolean) } : null,
    joins: list(answers['rpg.joinsOpen']).map(row => text(row?.name)).filter(Boolean),
    offers: list(opts.offers).filter(row => row?.state === 'offer' || row?.state === 'working').length,
    unrecorded: opts.unrecorded === true,
  };
}
