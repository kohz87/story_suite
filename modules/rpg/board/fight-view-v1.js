// The v1 fight as the Fight view (FIGHT_SHAPE): foe groups, party bars, every standing hero's actions with the input each one stands for, the log and the end card.
// Pure: it reads the sheet the fight started from and the played record, so a swipe, a Re-read, a rewind or a reload that leaves the same steps gives the same view.
import { actorIdOf } from '../roster.js';
import { readSheet } from '../read.js';
import { skillCost } from '../combat/skills.js';
import { logOfV1 } from './fight-view-v1-log.js';

const TIER = { mob: 'Mob', minion: 'Minion', standard: 'Standard', elite: 'Elite', boss: 'Boss', apex: 'Apex' };
const END = { win: 'won', loss: 'lost', fled: 'fled' };
const POOL = { sp: 'SP', mp: 'MP' };
const whole = value => Math.max(0, Math.trunc(Number(value)) || 0);
const standing = actor => whole(actor.hp) > 0;

function foeGroupsOf(record, sheet) {
    const groups = new Map();
    for (const foe of record.foes) groups.set(String(foe.id).split('.')[0], [...(groups.get(String(foe.id).split('.')[0]) ?? []), foe]);
    return [...groups].map(([slot, list]) => {
        const real = sheet.foes.find(entry => String(entry.slot) === slot);
        return { id: slot, arg: { group: Number(slot) }, name: String(real?.name ?? list[0].label), tier: TIER[list[0].tier] ?? null, lv: whole(list[0].level), odds: { word: null },
            members: [...list].sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true })).map(foe => ({ id: String(foe.id), arg: { target: String(foe.id) }, name: String(foe.label), hp: whole(foe.hp), max: Math.max(1, whole(foe.maxHp)) })) };
    });
}

// One hero's actions: the normal attack, the attack, area and heal skills the hero owns (the engine plays the first of each type), and Flee. A stance is the engine's own (always on when it can be paid).
function actionsOf(hero, anyFoe, wounded) {
    const groups = { Attack: [], Magic: [], Item: [], Flee: [] }, resources = { sp: whole(hero.sp), mp: whole(hero.mp) };
    const owned = type => (hero.skills ?? []).find(skill => skill.type === type) ?? null;
    const tile = (group, id, label, cost, target, pick, enabled = true) => groups[group].push({ id, label, cost, target, damage: null, odds: null, enabled, pick });
    tile('Attack', 'normal', 'Attack', 'Free', 'member', { choice: 'normal', args: {} }, anyFoe);
    for (const [type, choice, target, extra] of [['attack', 'attack', 'member', {}], ['area', 'area', 'none', { area: true }]]) {
        const skill = owned(type);
        if (!skill) continue;
        const price = skillCost({ type, stat: skill.stat }, resources);
        tile(price.pool === 'mp' ? 'Magic' : 'Attack', choice, skill.name || type, `${skill.stat ? `${skill.stat.toUpperCase()} · ` : ''}${price.cost} ${POOL[price.pool]}`, target, { choice, args: extra }, anyFoe && !price.fallback);
    }
    const heal = owned('heal');
    if (heal) {
        const price = skillCost({ type: 'heal', stat: heal.stat }, resources);
        tile('Magic', 'heal', heal.name || 'Heal', `${heal.stat ? `${heal.stat.toUpperCase()} · ` : ''}${price.cost} ${POOL[price.pool]}`, 'ally', { choice: 'heal', args: {} }, price.affordable && wounded);
    }
    tile('Flee', 'flee', 'Flee', 'Escape', 'none', { choice: 'flee', args: {}, alone: true });
    return groups;
}

/** The FIGHT_SHAPE view of a v1 fight: `record` is the engine's record after `steps` (the play's `view.result`); `place` is not known here, so the title is plain. */
export function v1View(state, setup, steps, record) {
    const sheet = readSheet({ domains: { dataModules: state.domains.dataModules, inventory: state.domains.inventory, scene: state.domains.scene } });
    const modules = new Map(sheet.characters.filter(character => character.v1 === true).map(character => [character.key, character.module]));
    const ended = record.result !== 'unfinished', foeGroups = foeGroupsOf(record, sheet), anyFoe = record.foes.some(standing), wounded = record.party.some(hero => standing(hero) && whole(hero.hp) < whole(hero.maxHp));
    const party = record.party.map(hero => ({ id: String(hero.id), arg: { target: String(hero.id) }, actorId: actorIdOf(modules.get(hero.id)), name: String(hero.label), portrait: null,
        hp: whole(hero.hp), hpMax: whole(hero.maxHp), mp: whole(hero.mp), mpMax: whole(hero.maxMp), sp: whole(hero.sp), spMax: whole(hero.maxSp), chosen: null }));
    const actors = ended ? [] : record.party.filter(standing).map(hero => ({ id: actorIdOf(modules.get(hero.id)), groups: actionsOf(hero, anyFoe, wounded) }));
    const played = whole(record.exchanges), played0 = whole(setup.offset) + steps.length, label = hero => String(hero.label);
    const sides = { party: record.party.map(label), foes: foeGroups.map(group => group.name) }, first = record.order?.first === 'foes' ? 'foes' : 'party';
    return {
        state: ended ? 'end' : steps.length ? 'after' : 'choose', title: 'Fight', subtitle: null, exchange: Math.max(1, ended || steps.length ? played || played0 : played + 1),
        foeGroups, party, actor: actors[0] ? { id: actors[0].id, stance: null, groups: actors[0].groups } : null, actors,
        order: [...sides[first], ...sides[first === 'party' ? 'foes' : 'party']], bonuses: null, log: logOfV1(record), narratorTold: null,
        end: ended ? { outcome: END[record.result] ?? 'won', xpEach: null, exchanges: whole(steps.length || record.rounds.length), members: party.map(hero => ({ id: hero.id, hp: hero.hp, hpMax: hero.hpMax, practice: [] })) } : null,
    };
}
