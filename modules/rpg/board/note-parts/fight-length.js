// Decides how long the narrator tells a fight: about 100 words, or at most 250 when it was intense.

// How long the narrator tells this reply's fight (owner rule, 15 Nov): about 100 words, or at most 250 when the fight was intense. Chosen by code from the
// recorded result, so the same fight always gets the same instruction; the exchange detail stays in the battle log. Only a fight opened under the
// `fightLen` rule mark (setup.fightLen = 1, session.js) gets it, so an older fight keeps its stored note and a Re-read rebuilds it unchanged. Head counts come
// from the result's own turn order (party entries) and foe members (a pack counts its foes); a result without them never counts as outnumbered.
export const LONG_FIGHT = 20, OUTNUMBERED = 3;
const wentDown = line => [line?.damage, line?.cost].some(move => move && !/:(mana|stamina)$/u.test(String(move.id ?? '')) && Number(move.from) > 0 && Number(move.to) <= 0);
export function intenseFight(result) {
    const lines = [...(result.opening ?? []), ...(result.rounds ?? []).flatMap(round => round.lines ?? [])];
    const down = lines.some(wentDown) || (result.hurts ?? []).some(hurt => !/:(mana|stamina)$/u.test(String(hurt?.id ?? '')) && Number(hurt?.from) > 0 && Number(hurt?.to) <= 0);
    const order = Array.isArray(result.order) ? result.order : [], party = order.filter(entry => entry?.party === true).length;
    const foes = Array.isArray(result.members) ? result.members.reduce((sum, foe) => sum + (Number.isInteger(foe?.count) ? foe.count : 1), 0) : order.filter(entry => entry?.party === false).length;
    const outnumbered = party > 0 && foes >= OUTNUMBERED * party;
    return down || (result.rounds ?? []).length >= LONG_FIGHT || outnumbered || result.stop === 'lost' || result.stop === 'fled';
}
export const fightLength = result => intenseFight(result)
    ? 'Tell the fight in at most 250 words, in up to three short paragraphs: the opening, the turning point, the finish; the battle log keeps the blow-by-blow.'
    : 'Tell the fight in about 100 words: how it opened, the deciding moment, how it ended; the battle log keeps the blow-by-blow.';
