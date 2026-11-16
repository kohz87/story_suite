// One exchange for a set of party choices: stance upkeep, party actions with tempo, foe attacks with the lone rule,
// resource spending, damage and the exact lines and bar moves that follow. The fight order is per side (the trace baseline).

import { damageOf, healOf, soakOf, takeHit } from './damage.js';
import { foeAttacks } from './foe-turns.js';
import { foeStats } from './foes.js';
import { V1 } from './numbers.js';
import { foeRoll, playerRoll, rollOutcome } from './rolls.js';
import { skillCost } from './skills.js';
import { tempoChain } from './tempo.js';

// Sim builds, kept only for parity. C5/C6 must replace this with the sheet's real skills and stats (COMBAT-PLAN "must-settle").
const PROFILES = {
    Warrior: { stat: 'str', pool: 'sp', magic: false },
    Skirmisher: { stat: 'agi', pool: 'sp', magic: false },
    'Skirmisher-Move': { stat: 'agi', pool: 'sp', magic: false },
    'Skirmisher-plain': { stat: 'agi', pool: 'sp', magic: false },
    'Skirmisher-area': { stat: 'agi', pool: 'sp', magic: false, area: true },
    Mage: { stat: 'int', pool: 'mp', magic: true },
    Healer: { stat: 'int', pool: 'mp', magic: true, heal: true },
};

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const labelOf = actor => String(actor?.label ?? actor?.name ?? actor?.id ?? '');
const idOf = actor => String(actor?.id ?? actor?.label ?? actor?.name ?? '');
const statsOf = actor => {
    const raw = actor?.stats ?? {}, out = {};
    for (const [key, value] of Object.entries(raw)) out[key.toLowerCase()] = value;
    return out;
};
const levelOf = actor => number(actor?.level ?? actor?.lv, V1.level.min);
const masteryOf = actor => Math.max(0, Math.floor(number(actor?.mastery)));
const profileOf = actor => {
    const base = PROFILES[actor?.build] ?? {
        stat: actor?.attack?.stat ?? 'str', pool: actor?.attack?.pool ?? 'sp', magic: actor?.attack?.magic === true,
    };
    return { ...base, area: base.area || actor?.area === true, heal: base.heal || actor?.heal === true };
};
const resources = actor => ({ sp: number(actor?.sp), mp: number(actor?.mp) });
const living = list => list.filter(actor => number(actor?.hp) > 0);
const refMatch = (actor, ref) => ref !== undefined && ref !== null
    && (ref === actor || String(ref) === idOf(actor) || String(ref) === labelOf(actor));

function cloneActor(actor, index) {
    const stats = statsOf(actor), level = levelOf(actor);
    return {
        ...actor, id: idOf(actor) || `actor-${index + 1}`, label: labelOf(actor) || `actor-${index + 1}`,
        level, stats, mastery: masteryOf(actor), hp: number(actor?.hp),
        maxHp: number(actor?.maxHp ?? actor?.maxhp ?? actor?.hp), mp: number(actor?.mp),
        maxMp: number(actor?.maxMp ?? actor?.maxmp ?? actor?.mp), sp: number(actor?.sp),
        maxSp: number(actor?.maxSp ?? actor?.maxsp ?? actor?.sp), stance: null,
        stances: (actor?.stances ?? []).map(item => typeof item === 'string' ? item.toLowerCase() : String(item?.type ?? '').toLowerCase()).filter(Boolean),
        gearSoak: number(actor?.gearSoak ?? actor?.soak),
    };
}

function recordMove(actor, bar, to, moves) {
    const from = number(actor[bar]), next = Math.max(0, Math.floor(number(to, from)));
    if (next === from) return;
    actor[bar] = next;
    moves.push({ id: idOf(actor), label: labelOf(actor), bar, from, to: next, amount: next - from });
}

function spend(actor, pool, cost, moves) {
    if (!pool || cost <= 0) return cost === 0;
    const held = number(actor[pool]);
    if (held < cost) return false;
    recordMove(actor, pool, held - cost, moves);
    return true;
}

function dieAt(roll, kind, slot, where) {
    if (typeof roll !== 'function') throw new TypeError(`${where}: a fight needs a dice source.`);
    const value = Number(roll(kind, slot));
    if (!Number.isInteger(value) || value < 1 || value > V1.die) throw new TypeError(`${where}: a d20 must be a whole number from 1 to ${V1.die}.`);
    return value;
}

function opposition(foe) {
    return foeRoll(foe, 'attack');
}

function foeDamage(foe) {
    const given = foe?.damage ?? foe?.dmg;
    return Number.isFinite(Number(given)) ? Math.max(0, Math.floor(Number(given))) : foeStats(foe).damage;
}

function lowerTarget(list, ref) {
    return list.find(actor => refMatch(actor, ref)) ?? null;
}

function lowestFoe(state, ref) {
    const standing = living(state.foes);
    return lowerTarget(standing, ref) ?? standing.reduce((best, foe) => (!best || number(foe.hp) < number(best.hp) ? foe : best), null);
}

function stanceUpkeep(actor, choice, orderIndex, lines, moves) {
    const profile = profileOf(actor), owned = actor.stances;
    const wanted = choice?.stance === undefined ? true : choice.stance;
    let active = null;
    if (wanted !== false && wanted !== 'off' && owned.length) {
        const type = wanted === true ? owned[0] : String(wanted).toLowerCase();
        if (owned.includes(type)) {
            const price = skillCost({ type, stat: profile.magic ? 'wis' : 'agi' }, resources(actor));
            if (price.affordable && spend(actor, price.pool, price.cost, moves)) active = type;
        }
    }
    actor.stance = active;
    lines.push(['stance', labelOf(actor), active ? [active] : []]);
    return orderIndex;
}

function playerAttack(state, actor, foe, base, how, profile, roll, slot, lines, moves) {
    const die = dieAt(roll, 'act', slot, `${labelOf(actor)} attack`);
    const bonus = playerRoll(profile.magic ? 'magic' : 'physical', actor.stats, actor.level);
    const total = die + bonus;
    if (die === V1.roll.naturalMiss) {
        lines.push(['attack', labelOf(actor), how, labelOf(foe), die, total, null, null, 'miss-nat1', 0, number(foe.hp)]);
        return false;
    }
    const foeDie = dieAt(roll, 'foe', slot, `${labelOf(actor)} attack defence`);
    const against = foeDie + opposition(foe), outcome = rollOutcome(die, bonus, against, 'player');
    if (outcome === 'miss') {
        lines.push(['attack', labelOf(actor), how, labelOf(foe), die, total, foeDie, against, 'miss', 0, number(foe.hp)]);
        return false;
    }
    const damage = takeHit(base, 0, outcome === 'decisive'), before = number(foe.hp), after = Math.max(0, before - damage);
    recordMove(foe, 'hp', after, moves);
    lines.push(['attack', labelOf(actor), how, labelOf(foe), die, total, foeDie, against, outcome, damage, number(foe.hp)]);
    return true;
}

function skillDamage(actor, profile, area = false) {
    const single = damageOf('skill', actor.stats, masteryOf(actor), profile.stat);
    return area ? Math.max(V1.damage.min, Math.floor(single * V1.areaPercent / V1.percent)) : single;
}

// A heal goes to a living ally below full health: the chosen one when valid, else the most wounded (the auto policy).
function healTarget(state, choice) {
    const wounded = living(state.party).filter(ally => number(ally.hp) < number(ally.maxHp));
    const wanted = lowerTarget(wounded, choice?.target);
    if (wanted) return wanted;
    return living(state.party).filter(ally => number(ally.hp) * V1.fight.healBelowTimes < number(ally.maxHp)).reduce((best, ally) => (!best
        || number(ally.hp) / Math.max(1, number(ally.maxHp)) < number(best.hp) / Math.max(1, number(best.maxHp)) ? ally : best), null);
}

function performHeal(actor, state, choice, lines, moves) {
    const target = healTarget(state, choice);
    if (!target) return { paid: false };
    const price = skillCost({ type: 'heal', stat: 'wis' }, resources(actor));
    if (!price.affordable || !spend(actor, price.pool, price.cost, moves)) return { paid: false };
    const amount = healOf(actor.stats, masteryOf(actor)), after = Math.min(number(target.maxHp), number(target.hp) + amount);
    recordMove(target, 'hp', after, moves);
    lines.push(['heal', labelOf(actor), labelOf(target), amount, number(target.hp)]);
    return { paid: true, acted: false, target: null };
}

function performAttack(actor, state, choice, profile, roll, slots, lines, moves) {
    const standing = living(state.foes);
    const target = lowestFoe(state, choice?.target);
    if (!target) return { acted: false, target: null };
    const automatic = !choice?.kind || choice.kind === 'auto';
    const wantsArea = choice?.kind === 'area' || (automatic && profile.area && standing.length >= V1.fight.areaTargets);
    if (wantsArea) {
        const price = skillCost({ type: 'area', stat: profile.stat }, resources(actor));
        if (!price.fallback && spend(actor, price.pool, price.cost, moves)) {
            const damage = skillDamage(actor, profile, true);
            let hit = false;
            standing.forEach((foe, index) => {
                hit = playerAttack(state, actor, foe, damage, 'area', profile, roll, slots.action + index, lines, moves) || hit;
            });
            return { acted: hit, target };
        }
    }
    if (choice?.kind === 'normal') {
        const damage = damageOf(profile.magic ? 'magic' : 'physical', actor.stats);
        return { acted: playerAttack(state, actor, target, damage, 'normal', profile, roll, slots.action, lines, moves), target };
    }
    const price = skillCost({ type: 'attack', stat: profile.stat }, resources(actor));
    const fallback = price.fallback || !spend(actor, price.pool, price.cost, moves);
    const damage = fallback ? damageOf(profile.magic ? 'magic' : 'physical', actor.stats) : skillDamage(actor, profile);
    return { acted: playerAttack(state, actor, target, damage, fallback ? 'normal' : 'skill', profile, roll, slots.action, lines, moves), target };
}

function performFlee(actor, state, roll, slots, lines) {
    const standing = living(state.foes);
    const strongest = standing.reduce((best, foe) => (!best || opposition(foe) > opposition(best) ? foe : best), null);
    if (!strongest) return { fled: false, triedFlee: true, acted: false, target: null };
    const die = dieAt(roll, 'flee', slots.action, `${labelOf(actor)} flee`);
    const bonus = playerRoll('flee', actor.stats, actor.level), mine = die + bonus;
    const foeDie = dieAt(roll, 'foe', slots.action, `${labelOf(strongest)} flee defence`);
    const theirs = foeDie + opposition(strongest);
    const outcome = rollOutcome(die, bonus, theirs, 'flee');
    lines.push(['flee', labelOf(actor), labelOf(strongest), die, mine, foeDie, theirs, outcome === 'success']);
    return { fled: outcome === 'success', triedFlee: true, acted: false, target: null };
}

function perform(actor, state, choice, profile, roll, slots, lines, moves) {
    const kind = choice?.kind ?? 'auto';
    if (kind === 'flee') return performFlee(actor, state, roll, slots, lines);
    if (kind !== 'auto' && kind !== 'attack' && kind !== 'skill' && kind !== 'area' && kind !== 'normal' && kind !== 'heal') {
        throw new TypeError(`Unknown exchange action: ${kind}`);
    }
    if (kind === 'heal' || (kind === 'auto' && profile.heal)) {
        const hurt = living(state.party).some(ally => number(ally.hp) * V1.fight.healBelowTimes < number(ally.maxHp));
        if (kind === 'heal' || hurt) {
            const healed = performHeal(actor, state, choice, lines, moves);
            if (healed.paid) return healed;
        }
    }
    return performAttack(actor, state, choice, profile, roll, slots, lines, moves);
}

function tempoWins(actor, foe, roll, slot, lines, used) {
    const die = dieAt(roll, 'act', slot, `${labelOf(actor)} tempo`);
    const mine = die + playerRoll('tempo', actor.stats, actor.level, { mastery: masteryOf(actor), stance: actor.stance });
    const foeDie = dieAt(roll, 'foe', slot, `${labelOf(actor)} tempo defence`);
    const theirs = foeDie + opposition(foe);
    const link = tempoChain({ agility: number(actor.stats.agi, V1.stat.start), stance: actor.stance, margin: mine - theirs, used });
    lines.push(['tempo', labelOf(actor), labelOf(foe), die, mine, foeDie, theirs, link.won]);
    return link;
}

function heroTurn(actor, state, choice, roll, actorIndex, lines, moves) {
    const standing = living(state.foes);
    if (!standing.length) return { result: null };
    const profile = profileOf(actor);
    let actionNo = 0;
    const slots = { action: actorIndex * 1000 + actionNo * 50 };
    const first = perform(actor, state, choice, profile, roll, slots, lines, moves);
    if (first.triedFlee) return { result: first.fled ? 'fled' : null };
    let landed = first.acted, target = first.target;
    const cap = tempoChain({ agility: number(actor.stats.agi, V1.stat.start), stance: actor.stance }).cap;
    while (landed && actionNo < cap && living(state.foes).length) {
        const tempoSlot = actorIndex * 1000 + (actionNo + 1) * 50 + 40;
        const link = tempoWins(actor, target, roll, tempoSlot, lines, actionNo);
        if (!link.extra) break;
        actionNo += 1;
        slots.action = actorIndex * 1000 + actionNo * 50;
        const next = perform(actor, state, choice, profile, roll, slots, lines, moves);
        landed = next.acted;
        target = next.target ?? target;
    }
    return { result: null };
}

function foeAttack(foe, hero, roll, slot, lines, moves) {
    const die = dieAt(roll, 'foe', slot, `${labelOf(foe)} attack`);
    const attack = die + opposition(foe);
    const evasionDie = dieAt(roll, 'check', slot, `${labelOf(hero)} evasion`);
    const evasion = evasionDie + playerRoll('evasion', hero.stats, hero.level, { mastery: masteryOf(hero), stance: hero.stance });
    const outcome = rollOutcome(die, opposition(foe), evasion, 'foe');
    if (outcome === 'evaded') {
        lines.push(['foe-attack', labelOf(foe), labelOf(hero), die, attack, evasionDie, evasion, 'evaded', 0, 0, number(hero.hp)]);
        return;
    }
    const soak = soakOf(number(hero.stats.vit), hero.stance === 'defence' ? masteryOf(hero) : 0, hero.gearSoak);
    const damage = takeHit(foeDamage(foe), soak, outcome === 'decisive'), before = number(hero.hp), after = Math.max(0, before - damage);
    recordMove(hero, 'hp', after, moves);
    lines.push(['foe-attack', labelOf(foe), labelOf(hero), die, attack, evasionDie, evasion, outcome, soak, damage, number(hero.hp)]);
}

function choiceFor(choices, actor, index) {
    if (Array.isArray(choices)) return choices[index] ?? null;
    if (choices && typeof choices === 'object') return choices[idOf(actor)] ?? choices[labelOf(actor)] ?? null;
    return null;
}

/**
 * Play one exchange on a copy of `sheet` ({ party, foes }). `choices` is an object keyed by hero id/label or an array in
 * party order; a missing hero choice is automatic (the simulator's policy). `options.roll(kind, slot)` returns each d20,
 * `options.order` is the fight's fixed per-side order, and `options.rotation` keeps the foe target rotation.
 * Returns { sheet, lines, moves, order, rotation, result } with result null while the fight is open.
 */
export function playExchange(sheet, choices = null, options = {}) {
    if (!sheet || !Array.isArray(sheet.party) || !Array.isArray(sheet.foes)) throw new TypeError('An exchange needs a sheet with party and foes.');
    if (typeof options.roll !== 'function') throw new TypeError('An exchange needs a dice source.');
    const party = sheet.party.map(cloneActor), foes = sheet.foes.map(cloneActor);
    const order = options.order ?? { party: party.map(idOf), foes: foes.map(idOf), first: 'party' };
    const byId = new Map([...party, ...foes].map(actor => [idOf(actor), actor]));
    const lines = [], moves = [];
    let rotation = Math.max(0, Math.floor(number(options.rotation))), result = null;
    const turn = options.number ?? 1;
    lines.push(['exchange', turn]);
    order.party.forEach((id, index) => {
        const actor = byId.get(String(id));
        if (actor && number(actor.hp) > 0) stanceUpkeep(actor, choiceFor(choices, actor, index), index, lines, moves);
    });
    const partyPhase = () => {
        for (const [index, id] of order.party.entries()) {
            const actor = byId.get(String(id));
            if (!actor || number(actor.hp) <= 0 || !living(foes).length) continue;
            const done = heroTurn(actor, { party, foes }, choiceFor(choices, actor, index), options.roll, index, lines, moves);
            if (done.result) { result = done.result; return; }
        }
        if (!living(foes).length) result = 'win';
        else if (!living(party).length) result = 'loss';
    };
    const foePhase = () => {
        const attackers = foeAttacks(party, foes), targets = living(party);
        if (!attackers.length || !targets.length) return;
        lines.push(['foe-phase', attackers.map(labelOf)]);
        attackers.forEach((foe, index) => {
            const standing = living(party);
            if (!standing.length) return;
            const hero = standing[rotation % standing.length];
            rotation += 1;
            foeAttack(foe, hero, options.roll, 1000000 + index * 10, lines, moves);
        });
        if (!living(party).length) result = 'loss';
    };
    if (order.first === 'party') { partyPhase(); if (!result) foePhase(); } else { foePhase(); if (!result) partyPhase(); }
    return { sheet: { party, foes }, lines, moves, order, rotation, result };
}
