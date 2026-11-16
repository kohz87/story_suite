// A Combat Rules v1 fight's record (the settle's `data.v2.result`, `board.v1`) read into the battle log's model, the same shape `readResolve` gives an old roll:
// each exchange of THIS settle is a round (numbered from where the segment began), each blow, foe attack and heal a line with the HP it moved from and to.
// The rows are the engine's own (combat/record.js); nothing is worked out again here.
import { hpBefores } from '../../combat/record.js';
import { isRecord, list, words } from './util.js';

const HIT = new Set(['hit', 'decisive']);

// The skill a hero's row stands for, by the way the blow was made (the record keeps the way, not the name): the first skill of that type.
const skillFor = (hero, type) => words(list(hero?.skills).find(skill => skill?.type === type)?.name, 40);
const arrowOf = (who, before, after) => `${who} HP ${before === undefined || before === after ? '' : `${before} → `}${after}`;

function lineOf(row, before, heroes) {
    if (!Array.isArray(row)) return null;
    const hero = heroes.get(row[1]);
    if (row[0] === 'attack') {
        const [, who, how, target, , total, , against, outcome, , hpAfter] = row, hit = HIT.has(outcome);
        return { outcome: hit ? 'success' : 'fail', total: Number.isFinite(total) ? total : null, vs: Number.isFinite(against) ? against : null, skill: how === 'skill' ? skillFor(hero, 'attack') : how === 'area' ? skillFor(hero, 'area') : '',
            breakdown: '', arrows: hit ? [arrowOf(words(target, 40), before, hpAfter)] : [], who: words(who, 40), target: words(target, 40), foe: false, ...(outcome === 'decisive' ? { decisive: true } : {}) };
    }
    if (row[0] === 'foe-attack') {
        const [, foe, target, , , , , outcome, , , hpAfter] = row, hit = outcome !== 'evaded' && outcome !== 'miss';
        return { outcome: hit ? 'fail' : 'success', total: null, vs: null, skill: '', breakdown: '', arrows: hit ? [arrowOf(words(target, 40), before, hpAfter)] : [], who: words(foe, 40), target: words(target, 40), foe: true, ...(outcome === 'decisive' ? { decisive: true } : {}) };
    }
    if (row[0] === 'heal') {
        const [, who, target, , hpAfter] = row;
        return { outcome: 'success', total: null, vs: null, skill: skillFor(hero, 'heal'), breakdown: '', arrows: [arrowOf(words(target, 40), before, hpAfter)], who: words(who, 40), target: words(target, 40), foe: false, support: true, heals: true };
    }
    return null;
}

/** The panel model of a v1 result, or null when the segment played no exchange. */
export function readResolveV1(result) {
    if (!isRecord(result) || !list(result.rounds).length) return null;
    const heroes = new Map(list(result.party).filter(isRecord).map(hero => [hero.label, hero]));
    // (the record's `lines` also hold the opening rows - initiative, order - so the rounds' rows are its tail: the HP a hit started from is found over all of them, then read at the tail)
    const flat = list(result.rounds).flat(), all = list(result.lines), skip = all.length - flat.length;
    const before = skip >= 0 && JSON.stringify(all.slice(skip)) === JSON.stringify(flat) ? hpBefores(all, list(result.moves)).slice(skip) : [];
    let at = 0;
    const first = Math.max(0, (Number(result.exchanges) || 0) - list(result.rounds).length);
    const rounds = list(result.rounds).map((rows, index) => ({ n: first + index + 1, lines: list(rows).map(row => lineOf(row, before[at++], heroes)).filter(line => line?.who) })).filter(round => round.lines.length);
    if (!rounds.length) return null;
    const names = new Map([...list(result.party), ...list(result.foes)].filter(isRecord).map(actor => [String(actor.id), words(actor.label, 40)]));
    const order = [...list(result.order?.party), ...list(result.order?.foes)].map(id => names.get(String(id)) ?? words(String(id), 40)).filter(Boolean);
    return { rounds, checks: [], refused: [], order, stop: typeof result.stop === 'string' ? result.stop : '', pace: '', flow: 2, cap: 0, board: true };
}
