// The old-engine fight as the Fight view (FIGHT_SHAPE): the same data the pre-port board drew, for every standing member (the board answers for one member at a time, so each member's actions are asked on the sheet its earlier picks left).
// Pure: it plays the staged exchanges again on a private copy, so the view always equals what a settle would play.
import { fold, readSheet } from '../read.js';
import { actorIdOf } from '../roster.js';
import { usesOf } from '../practice.js';
import { PRACTICE, practiceOf } from '../names.js';
import { equipmentForBoard, playBoard } from './engine.js';
import { boardChoices } from './view-data.js';
import { logOfOld, orderOfOld } from './fight-view-old-log.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = value => Math.max(0, Math.trunc(Number(value)) || 0);
const text = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const END = new Set(['won', 'fled', 'lost']);

function groupsOf(members, foes) {
    const byGroup = new Map();
    for (const member of Array.isArray(members) ? members : []) {
        if (!isRecord(member)) continue;
        const group = Number.isFinite(Number(member.group)) ? Number(member.group) : Number(member.slot);
        byGroup.set(group, [...(byGroup.get(group) ?? []), member]);
    }
    return [...byGroup].map(([group, list]) => {
        const real = foes.find(foe => Number(foe?.slot) === group);
        return { id: String(group), arg: { group }, name: text(real?.name ?? list[0].name.replace(/ pack \d+$/u, '').replace(/ \d+$/u, '')), tier: null, lv: Number.isFinite(real?.level) ? real.level : 0, odds: { word: null },
            members: list.map(member => ({ id: String(member.slot), arg: { target: Number(member.slot) }, name: text(member.name), hp: whole(member.value), max: Math.max(1, whole(member.size)) })) };
    });
}

// One board choice → a tile; `Use item` becomes one tile per stack (the input needs its stack), and a heal that already names its mate needs no target.
function tilesOf(choice, at, foeGroups, areaAll) {
    const action = isRecord(choice?.action) ? choice.action : {}, info = isRecord(choice.view) ? choice.view : {}, { kind, ...rest } = action;
    const pool = info.uses === 'mana' ? 'Mana' : 'Stamina', stat = info.stat ? String(info.stat).toUpperCase() : null, enabled = !choice.reason;
    if (kind === 'flee') return [['Flee', { id: `flee:${at}`, label: 'Flee', cost: 'Escape', target: 'none', damage: null, odds: null, enabled, pick: { choice: 'flee', args: rest, alone: true } }]];
    if (kind === 'item') return (choice.items ?? []).map(item => ['Item', { id: `item:${at}:${item.stack}`, label: `${text(item.name)} ×${item.qty}`, cost: `${item.pool} +${item.blocks}`, target: 'ally', damage: null, odds: null, enabled, pick: { choice: 'item', args: { ...rest, stack: item.stack, pool: item.pool } } }]);
    const cost = kind === 'attack' ? `${stat ?? 'STR'} damage · free` : `${stat ? `${stat} · ` : ''}${whole(info.cost) || 1} ${pool}`;
    const target = action.support ? (action.target === undefined ? 'ally' : 'none') : info.area ? (foeGroups.length > 1 && !areaAll ? 'group' : 'none') : 'member';
    return [[kind === 'skill' && info.uses === 'mana' ? 'Magic' : 'Attack', { id: `${kind}:${at}`, label: text(info.name), cost, target, damage: null, odds: null, enabled, pick: { choice: String(kind ?? ''), args: info.area ? { ...rest, area: true } : rest } }]];
}

/** The FIGHT_SHAPE view of an old-engine fight: `exchanges` are the staged steps as the engine reads them (`toExchanges`). Throws when the engine refuses them (the caller then keeps the plain preview). */
export function oldView(state, setup, steps, exchanges) {
    const real = { domains: { dataModules: state.domains.dataModules, inventory: state.domains.inventory, scene: state.domains.scene } };
    const played = playBoard(real, setup, exchanges);
    if (played.error) throw new Error(played.error);
    const result = played.result, now = played.state, sheet = readSheet(now), ended = END.has(result.stop);
    const foeGroups = groupsOf(result.members, sheet.foes), areaAll = setup.areaAll === 1, gear = setup.gear ? equipmentForBoard(now, setup.gear) : {};
    const cast = sheet.characters.filter(person => person.left !== true), standing = cast.filter(person => person.alive !== false && person.health !== 0);
    const party = cast.map(person => ({ id: fold(person.who), arg: { target: text(person.who) }, actorId: actorIdOf(person.module), name: text(person.who), portrait: null, hp: whole(person.health), hpMax: whole(person.size?.health),
        mp: whole(person.mana), mpMax: whole(person.size?.mana), sp: whole(person.stamina), spMax: whole(person.size?.stamina), chosen: null }));
    const actors = ended ? [] : standing.map((person, index) => {
        const answer = boardChoices(now, { ...setup, ...gear }, standing.slice(0, index).map(earlier => ({ who: earlier.who })), null), groups = { Attack: [], Magic: [], Item: [], Flee: [] };
        answer.choices.forEach((choice, at) => { for (const [group, tile] of tilesOf(choice, at, foeGroups, areaAll)) groups[group].push(tile); });
        return { id: actorIdOf(person.module), groups };
    });
    const rounds = result.rounds ?? [], played0 = whole(setup.offset) + steps.length, perUse = practiceOf(setup.practice) ?? PRACTICE.perUse;
    const uses = usesOf(result);
    return {
        state: ended ? 'end' : steps.length ? 'after' : 'choose', title: 'Fight', subtitle: null, exchange: Math.max(1, ended || steps.length ? played0 : played0 + 1), foeGroups, party,
        actor: actors[0] ? { id: actors[0].id, stance: null, groups: actors[0].groups } : null, actors, order: orderOfOld(result.order, result.members), bonuses: null, log: logOfOld(rounds), narratorTold: null,
        end: ended ? { outcome: result.stop, xpEach: null, exchanges: rounds.length, members: party.map(person => ({ id: person.id, hp: person.hp, hpMax: person.hpMax,
            practice: uses.filter(use => fold(use.who) === person.id).map(use => ({ skill: text(use.skill), gain: Math.min(PRACTICE.max, whole(use.n) * perUse) })) })) } : null,
    };
}
