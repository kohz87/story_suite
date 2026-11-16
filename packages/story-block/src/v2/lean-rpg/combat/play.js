// A whole saved fight from a private sheet, a fight seed and the per-exchange choices: initiative once, then pure
// exchanges until a side wins, the party flees, or the exchange cap leaves the fight unfinished.

import { barsOf } from './bars.js';
import { fightDice } from './dice.js';
import { playExchange } from './exchange.js';
import { foeStats } from './foes.js';
import { V1 } from './numbers.js';
import { initiative } from './order.js';
import { profileOf, skillsOf } from './profile.js';
import { resultOf } from './record.js';
import { foeRoll, playerRoll } from './rolls.js';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const labelOf = actor => String(actor?.label ?? actor?.name ?? actor?.id ?? '');
const statsOf = actor => {
    const out = {};
    for (const [key, value] of Object.entries(actor?.stats ?? {})) out[key.toLowerCase()] = value;
    return out;
};

function named(list, prefix) {
    const used = new Set();
    return list.map((actor, index) => {
        const base = String(actor?.id ?? actor?.label ?? actor?.name ?? `${prefix}-${index + 1}`);
        let id = base, suffix = 1;
        while (used.has(id)) id = `${base}#${suffix++}`;
        used.add(id);
        return { ...actor, id, label: labelOf(actor) || base };
    });
}

function hero(actor) {
    const stance = profileOf(actor).stance, stats = statsOf(actor), level = Math.floor(number(actor?.level ?? actor?.lv, V1.level.min)), bars = barsOf(stats, level);
    return {
        ...actor, level, stats, mastery: Math.max(0, Math.floor(number(actor?.mastery))),
        maxHp: Math.floor(number(actor?.maxHp ?? actor?.maxhp, bars.hp)), maxMp: Math.floor(number(actor?.maxMp ?? actor?.maxmp, bars.mp)),
        maxSp: Math.floor(number(actor?.maxSp ?? actor?.maxsp, bars.sp)),
        hp: Math.floor(number(actor?.hp, bars.hp)), mp: Math.floor(number(actor?.mp, bars.mp)), sp: Math.floor(number(actor?.sp, bars.sp)),
        skills: skillsOf(actor), stances: stance ? [stance.type] : [],
        gearSoak: Math.max(0, Math.floor(number(actor?.gearSoak ?? actor?.soak))),
    };
}

function foe(actor, index) {
    const level = Math.floor(number(actor?.level ?? actor?.lv, V1.level.min)), stats = foeStats({ level, tier: actor?.tier });
    return {
        ...actor, level, tier: stats.tier, maxHp: Math.floor(number(actor?.maxHp ?? actor?.maxhp, stats.hp)),
        hp: Math.floor(number(actor?.hp, stats.hp)), damage: Math.floor(number(actor?.damage ?? actor?.dmg, stats.damage)), roll: Math.floor(number(actor?.roll, stats.roll)),
    };
}

function sheetOf(input) {
    if (!input || !Array.isArray(input.party) || !Array.isArray(input.foes)) throw new TypeError('A fight needs a sheet with party and foes.');
    if (!input.party.length) throw new TypeError('A fight needs at least one hero.');
    return { party: named(input.party, 'hero').map(hero), foes: named(input.foes, 'foe').map(foe) };
}

function rollsOf(setup, exchange, offset) {
    if (typeof setup?.random === 'function') return () => setup.random();
    const source = fightDice(setup.dice, exchange, offset);
    return (kind, slot) => source(kind, Math.floor(number(slot)))();
}

function openingDie(roll, slot, who) {
    const value = Number(roll('init', slot));
    if (!Number.isInteger(value) || value < 1 || value > V1.die) throw new TypeError(`${who} initiative: a d20 must be a whole number from 1 to ${V1.die}.`);
    return value;
}

function seenOrder(order, party, foes) {
    const partyById = new Map(party.map(actor => [String(actor.id), actor])), foeById = new Map(foes.map(actor => [String(actor.id), actor]));
    return {
        party: order.party.map(id => partyById.get(String(id))).filter(Boolean),
        foes: order.foes.map(id => foeById.get(String(id))).filter(Boolean),
    };
}

// A fight carried over from an earlier reply: `setup.start` = { offset, order, rotation } (the exchanges already played, the fixed per-side order and the foe
// target rotation, as the earlier record gave them); the bars and the surviving foes are the sheet passed in (that record's party and foes).
function startOf(start, state) {
    if (start === undefined || start === null) return null;
    const ids = side => Array.isArray(side) && side.every(id => typeof id === 'string');
    if (typeof start !== 'object' || !Number.isInteger(start.offset) || start.offset < 1 || start.offset >= V1.fight.cap || !Number.isInteger(start.rotation) || start.rotation < 0
        || !start.order || !ids(start.order.party) || !ids(start.order.foes) || !['party', 'foes'].includes(start.order.first)) throw new TypeError('The fight start is damaged.');
    const known = list => new Set(list.map(actor => actor.id)), mine = known(state.party), theirs = known(state.foes);
    if (start.order.party.length !== mine.size || !start.order.party.every(id => mine.has(id)) || start.order.foes.length !== theirs.size || !start.order.foes.every(id => theirs.has(id))) {
        throw new TypeError('The fight start does not match the carried sheet.');
    }
    return { offset: start.offset, rotation: start.rotation, order: { party: [...start.order.party], foes: [...start.order.foes], first: start.order.first } };
}

function choiceAt(exchanges, number, autoRun, setup, offset = 0) {
    if (autoRun) return null;
    const entry = exchanges?.[number - offset - 1];
    if (entry === undefined || entry === null) return null;
    const choices = entry.choices ?? entry;
    const forced = setup?.flee?.[number] ?? setup?.flee?.[String(number)];
    if (!forced) return choices;
    const out = Array.isArray(choices) ? [...choices] : { ...(choices ?? {}) };
    if (Array.isArray(forced)) forced.forEach(label => { out[label] = { kind: 'flee' }; });
    else for (const [label, flee] of Object.entries(forced)) if (flee) out[label] = { kind: 'flee' };
    return out;
}

/**
 * Play a whole fight. `sheet` holds the party and foes; `setup` holds `dice` (the port's `dice(seed, offset)`; offset = `start.offset`, 0 for a first segment: see dice.js), optional `maxExchanges`, optional `flee`
 * overrides and an optional scripted `random()` for tests. Passing `exchanges` plays exactly those choices (an object
 * keyed by hero id/label or an array per exchange); omitting it uses the automatic whole-fight policy through the cap.
 * `setup.start` ({ offset, order, rotation }) continues a fight: no initiative is rolled, `input` is the carried sheet, `exchanges` are the new
 * exchanges only, and exchange numbers (dice, `flee` keys, `maxExchanges`, the record's `exchanges`) count on from `offset`.
 */
export function playBoard(input, setup = {}, exchanges = undefined) {
    if (!setup || typeof setup !== 'object') throw new TypeError('The fight setup is damaged.');
    if (typeof setup.random !== 'function' && typeof setup.dice !== 'function') throw new TypeError('A fight needs a dice source (the port\'s dice(seed, offset)) or a scripted random().');
    const autoRun = exchanges === undefined || exchanges === null;
    if (!autoRun && !Array.isArray(exchanges)) throw new TypeError('The saved exchanges must be a list.');
    const cap = Math.floor(number(setup.maxExchanges, V1.fight.maxExchanges));
    if (cap < 1 || cap > V1.fight.cap) throw new TypeError(`The exchange cap must be from 1 to ${V1.fight.cap}.`);
    const state = sheetOf(input), lines = [], moves = [], rounds = [], carried = startOf(setup.start, state), offset = carried?.offset ?? 0;
    let order = carried?.order;
    if (!carried) {
        const openingRoll = rollsOf(setup, 0, 0), partyTotals = [], foeTotals = [];
        state.party.forEach((actor, index) => {
            const die = openingDie(openingRoll, index, actor.label), total = die + playerRoll('order', actor.stats, actor.level);
            actor.total = total; partyTotals.push({ id: actor.id, total, agi: actor.stats.agi });
            lines.push(['init', actor.label, die, total]);
        });
        state.foes.forEach((actor, index) => {
            const die = openingDie(openingRoll, 100 + index, actor.label), total = die + foeRoll(actor, 'order');
            actor.total = total; foeTotals.push({ id: actor.id, total });
            lines.push(['init', actor.label, die, total]);
        });
        order = initiative(partyTotals, foeTotals);
    }
    const ordered = seenOrder(order, state.party, state.foes);
    state.party = ordered.party; state.foes = ordered.foes;
    if (!carried) lines.push(['order', state.party.map(actor => actor.label), state.foes.map(actor => actor.label), order.first]);
    let rotation = carried?.rotation ?? 0, played = offset, result = 'unfinished';
    const room = Math.max(0, cap - offset), limit = autoRun ? room : Math.min(exchanges.length, room);
    for (let at = offset + 1; at <= offset + limit; at += 1) {
        const choices = choiceAt(exchanges, at, autoRun, setup, offset);
        const done = playExchange(state, choices, { order, roll: rollsOf(setup, at, offset), number: at, rotation });
        lines.push(...done.lines); moves.push(...done.moves); rounds.push(done.lines);
        state.party = done.sheet.party; state.foes = done.sheet.foes; rotation = done.rotation; played = at;
        if (done.result) { result = done.result; break; }
    }
    return resultOf({ result, exchanges: played, order, rotation, party: state.party, foes: state.foes, lines, moves, rounds });
}
