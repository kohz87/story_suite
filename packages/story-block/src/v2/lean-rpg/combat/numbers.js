// Combat Rules v1: every literal number of the rule set lives here and nowhere else.
// Tables are frozen; the other combat files read them and hold no numbers of their own.

const deep = value => {
    if (value && typeof value === 'object') Object.values(value).forEach(deep);
    return Object.freeze(value);
};

/** Single numbers of the rule set (die, margins, caps, bar and foe formulas, costs). */
export const V1 = deep({
    die: 20,
    decisiveMargin: 8, decisiveTimes: 1.5, tempoMargin: 3, soakCap: 50, areaPercent: 60, percent: 100,
    stat: { min: 1, max: 30, start: 5, creationPoints: 10, creationCap: 10, perLevel: 1 },
    level: { min: 1, max: 99 },
    hp: { base: 5, levelDiv: 3, vitDiv: 2 },
    mp: { base: 8, levelDiv: 4, pairDiv: 4 },
    sp: { base: 8, levelDiv: 4, pairDiv: 4 },
    roll: {
        physicalDiv: 2, magicDiv: 2, evasionDiv: 3, tempoDiv: 2, orderDiv: 2, fleeDiv: 2, levelDiv: 4,
        naturalMiss: 1, masteryDiv: 2,
    },
    damage: { statDiv: 2, healDiv: 3, min: 1 },
    soak: { stanceStep: 5 },
    tempoStanceBonus: 1,
    foe: { rollBase: 6, rollLevelDiv: 3, hpBase: 8, hpLevelDiv: 2, damageBase: 3, damageLevelDiv: 6, damageRound: 0.5, defaultTier: 'standard', groupMax: 6 },
    cost: { normal: 0, attack: 1, area: 2, heal: 2, stance: 1, utility: 0 },
    skill: {
        defaultType: 'attack', normalType: 'normal', fallbackTypes: ['attack', 'area'],
        magicStats: ['int', 'wis'], pools: { physical: 'sp', magic: 'mp' },
        normal: { kind: 'action', cost: 'normal', pool: null, adds: 'damage' },
        types: {
            attack: { label: 'Attack', kind: 'action', cost: 'attack', pool: 'stat', adds: 'damage', aliases: ['attack'] },
            area: { label: 'Area attack', kind: 'action', cost: 'area', pool: 'stat', adds: 'damage', aliases: ['area', 'area attack', 'areaattack'] },
            defence: { label: 'Defence', kind: 'stance', cost: 'stance', pool: 'stat', adds: 'soak', aliases: ['defence', 'defense'] },
            evasion: { label: 'Evasion', kind: 'stance', cost: 'stance', pool: 'stat', adds: 'roll', aliases: ['evasion'] },
            movement: { label: 'Movement', kind: 'stance', cost: 'stance', pool: 'stat', adds: 'roll', aliases: ['movement'] },
            heal: { label: 'Heal', kind: 'action', cost: 'heal', pool: 'mp', adds: 'healing', aliases: ['heal', 'healing'] },
            support: { label: 'Support', kind: 'stance', cost: 'stance', pool: 'stat', adds: 'value', aliases: ['support'] },
            utility: { label: 'Utility', kind: 'story', cost: 'utility', pool: null, adds: 'check', aliases: ['utility'] },
        },
    },
});

/** Foe tiers: the HP and damage multiplier and the tier's roll bonus. An absent tier is V1.foe.defaultTier. */
export const TIERS = deep({
    mob: { mult: 0.25, roll: -2 },
    minion: { mult: 0.5, roll: -1 },
    standard: { mult: 1, roll: 0 },
    elite: { mult: 1.5, roll: 1 },
    boss: { mult: 2, roll: 2 },
    apex: { mult: 3, roll: 4 },
});

/** Skill ranks, lowest first: mastery, practice needed, minimum level. */
export const RANKS = deep([
    { name: 'Novice', mastery: 1, practice: 0, minLevel: 1 },
    { name: 'Apprentice', mastery: 2, practice: 100, minLevel: 1 },
    { name: 'Adept', mastery: 3, practice: 200, minLevel: 10 },
    { name: 'Expert', mastery: 4, practice: 300, minLevel: 25 },
    { name: 'Master', mastery: 5, practice: 400, minLevel: 45 },
    { name: 'Grandmaster', mastery: 6, practice: 500, minLevel: 65 },
    { name: 'Legend', mastery: 7, practice: 600, minLevel: 85 },
]);

/** Extra-action cap by AGI, highest threshold first; a Movement stance adds one more. */
export const TEMPO_CAPS = deep([
    { minAgi: 25, cap: 3 },
    { minAgi: 15, cap: 2 },
    { minAgi: 1, cap: 1 },
]);
