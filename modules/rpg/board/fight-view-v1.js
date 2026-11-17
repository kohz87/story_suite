// The v1 fight as the Fight view (FIGHT_SHAPE): foe groups, party bars, every standing hero's actions with the input each one stands for, the log and the end card.
// Pure: it reads the sheet the fight started from and the played record, so a swipe, a Re-read, a rewind or a reload that leaves the same steps gives the same view.
import { actorIdOf } from '../roster.js';
import { readSheet } from '../read.js';
import { skillCost } from '../combat/skills.js';
import { profileOf } from '../combat/profile.js';
import { soakOf } from '../combat/damage.js';
import { V1 } from './v1-kind.js';
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

// The hero's stance as the switch shows it, or null when the hero owns none. `on` is what the hero's last exchange did (the first counts as on: the engine turns the stance on by default); `soakOn` / `soakOff`
// are the soak with and without a Defence stance (null for the other stance types); `pool` / `cost` what it takes each exchange.
function stanceOf(hero, record, gear) {
    const owned = profileOf(hero).stance;
    if (!owned) return null;
    const line = (record.rounds.at(-1) ?? []).find(row => row[0] === 'stance' && row[1] === String(hero.label));
    const defence = owned.type === 'defence', soak = mastery => soakOf(hero.stats?.vit, mastery, Number(gear[hero.id]) || 0);
    const skill = (hero.skills ?? []).find(item => skillCost(item).type === owned.type), price = skillCost(skill ?? { type: owned.type });
    return { name: String(skill?.name || price.type), pool: price.pool === 'mp' ? 'Mana' : 'Stamina', cost: price.cost, on: line ? line[2].length > 0 : true, soakOn: defence ? soak(hero.mastery) : null, soakOff: defence ? soak(0) : null, paid: null };
}

// What the end card says each hero was paid: the practice (by name), each hero's own XP and, when every hero got the same, that XP once (`paid` = the settle's receipt, `{ xp: [{ who, xp }], practice: [{ who, skill, amount }] }`).
const practiceOfHero = (paid, who) => (paid?.practice ?? []).filter(entry => entry.who === who).map(({ skill, amount }) => ({ skill: String(skill), gain: amount }));
const xpOfHero = (paid, who) => (paid?.xp ?? []).find(entry => entry.who === who)?.xp ?? null;
const sameXp = paid => (paid?.xp?.length && paid.xp.every(entry => entry.xp === paid.xp[0].xp) ? paid.xp[0].xp : null);

/** The FIGHT_SHAPE view of a v1 fight: `record` is the engine's record after `steps` (the play's `view.result`); `paid` is the play's `result.paid` (what the ended fight pays); `place` is not known here, so the title is plain. */
export function v1View(state, setup, steps, record, paid = null) {
    const sheet = readSheet({ domains: { dataModules: state.domains.dataModules, inventory: state.domains.inventory, scene: state.domains.scene } });
    const modules = new Map(sheet.characters.filter(character => character.v1 === true).map(character => [character.key, character.module]));
    const ended = record.result !== 'unfinished', foeGroups = foeGroupsOf(record, sheet), anyFoe = record.foes.some(standing), wounded = record.party.some(hero => standing(hero) && whole(hero.hp) < whole(hero.maxHp));
    const party = record.party.map(hero => ({ id: String(hero.id), arg: { target: String(hero.id) }, actorId: actorIdOf(modules.get(hero.id)), name: String(hero.label), portrait: null,
        hp: whole(hero.hp), hpMax: whole(hero.maxHp), mp: whole(hero.mp), mpMax: whole(hero.maxMp), sp: whole(hero.sp), spMax: whole(hero.maxSp), chosen: null }));
    const gear = ended ? {} : V1.soak(state, sheet);
    const actors = ended ? [] : record.party.filter(standing).map(hero => ({ id: actorIdOf(modules.get(hero.id)), stance: stanceOf(hero, record, gear), groups: actionsOf(hero, anyFoe, wounded) }));
    const played = whole(record.exchanges), played0 = whole(setup.offset) + steps.length, label = hero => String(hero.label);
    const sides = { party: record.party.map(label), foes: foeGroups.map(group => group.name) }, first = record.order?.first === 'foes' ? 'foes' : 'party';
    return {
        state: ended ? 'end' : steps.length ? 'after' : 'choose', title: 'Fight', subtitle: null, exchange: Math.max(1, ended || steps.length ? played || played0 : played + 1),
        foeGroups, party, actor: actors[0] ? { id: actors[0].id, stance: actors[0].stance, groups: actors[0].groups } : null, actors,
        order: [...sides[first], ...sides[first === 'party' ? 'foes' : 'party']], bonuses: null, log: logOfV1(record), narratorTold: null,
        end: ended ? { outcome: END[record.result] ?? 'won', xpEach: sameXp(paid), exchanges: whole(steps.length || record.rounds.length), members: party.map(hero => ({ id: hero.id, hp: hero.hp, hpMax: hero.hpMax, xp: xpOfHero(paid, hero.name), practice: practiceOfHero(paid, hero.name) })) } : null,
    };
}
