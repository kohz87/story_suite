// A whole saved fight from a private sheet, a fight seed and the per-exchange choices: initiative once, then pure
// exchanges until a side wins, the party flees, or the exchange cap leaves the fight unfinished.

import { barsOf } from './bars.js';
import { fightDice } from './dice.js';
import { playExchange } from './exchange.js';
import { foeStats } from './foes.js';
import { V1 } from './numbers.js';
import { initiative } from './order.js';
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

function hero(actor, index) {
    const stats = statsOf(actor), level = Math.floor(number(actor?.level ?? actor?.lv, V1.level.min)), bars = barsOf(stats, level);
    return {
        ...actor, level, stats, mastery: Math.max(0, Math.floor(number(actor?.mastery))),
        maxHp: Math.floor(number(actor?.maxHp ?? actor?.maxhp, bars.hp)), maxMp: Math.floor(number(actor?.maxMp ?? actor?.maxmp, bars.mp)),
        maxSp: Math.floor(number(actor?.maxSp ?? actor?.maxsp, bars.sp)),
        hp: Math.floor(number(actor?.hp, bars.hp)), mp: Math.floor(number(actor?.mp, bars.mp)), sp: Math.floor(number(actor?.sp, bars.sp)),
        stances: (actor?.stances ?? []).map(item => typeof item === 'string' ? item.toLowerCase() : String(item?.type ?? '').toLowerCase()).filter(Boolean),
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

function dice(setup, exchange) {
    if (typeof setup?.random === 'function') return () => setup.random();
    const source = fightDice(setup.seed, exchange);
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

function choiceAt(exchanges, number, autoRun, setup) {
    if (autoRun) return null;
    const entry = exchanges?.[number - 1];
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
 * Play a whole fight. `sheet` holds the party and foes; `setup` holds `seed`, optional `maxExchanges`, optional `flee`
 * overrides and an optional scripted `random()` for tests. Passing `exchanges` plays exactly those choices (an object
 * keyed by hero id/label or an array per exchange); omitting it uses the automatic whole-fight policy through the cap.
 */
export function playBoard(input, setup = {}, exchanges = undefined) {
    if (!setup || typeof setup !== 'object') throw new TypeError('The fight setup is damaged.');
    if (typeof setup.random !== 'function' && (!Number.isInteger(setup.seed) || setup.seed < 0 || setup.seed > 0xFFFFFFFF)) {
        throw new TypeError('A fight needs a uint32 seed or a scripted dice source.');
    }
    const autoRun = exchanges === undefined || exchanges === null;
    if (!autoRun && !Array.isArray(exchanges)) throw new TypeError('The saved exchanges must be a list.');
    const cap = Math.floor(number(setup.maxExchanges, V1.fight.maxExchanges));
    if (cap < 1 || cap > 99) throw new TypeError('The exchange cap must be from 1 to 99.');
    const state = sheetOf(input), lines = [], moves = [], rounds = [];
    const openingRoll = dice(setup, 0), partyTotals = [], foeTotals = [];
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
    const order = initiative(partyTotals, foeTotals), ordered = seenOrder(order, state.party, state.foes);
    state.party = ordered.party; state.foes = ordered.foes;
    lines.push(['order', state.party.map(actor => actor.label), state.foes.map(actor => actor.label), order.first]);
    let rotation = 0, played = 0, result = 'unfinished';
    const limit = autoRun ? cap : Math.min(exchanges.length, cap);
    for (let at = 1; at <= limit; at += 1) {
        const choices = choiceAt(exchanges, at, autoRun, setup);
        const done = playExchange(state, choices, { order, roll: dice(setup, at), number: at, rotation });
        lines.push(...done.lines); moves.push(...done.moves); rounds.push(done.lines);
        state.party = done.sheet.party; state.foes = done.sheet.foes; rotation = done.rotation; played = at;
        if (done.result) { result = done.result; break; }
    }
    return resultOf({ result, exchanges: played, order, party: state.party, foes: state.foes, lines, moves, rounds });
}
