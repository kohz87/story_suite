// Test-only: the simulator builds as sheet skills. The engine reads only skills (each skill's own stat decides its pool and whether its hit is magic),
// so a parity or trace sheet derives its skills from the build name here, never in the engine.

const SKILLS = {
    Warrior: [['attack', 'str'], ['defence', 'agi']],
    Skirmisher: [['attack', 'agi'], ['speed', 'agi']],
    'Skirmisher-Move': [['attack', 'agi'], ['speed', 'agi']],
    'Skirmisher-plain': [['attack', 'agi']],
    'Skirmisher-area': [['attack', 'agi'], ['area', 'agi'], ['speed', 'agi']],
    Mage: [['attack', 'int'], ['speed', 'wis']],
    Healer: [['attack', 'int'], ['heal', 'wis'], ['defence', 'wis']],
};

/** The skills a build's sheet holds: `[{ name, type, stat }]`. */
export const skillsFor = build => (SKILLS[build] ?? []).map(([type, stat]) => ({ name: `${build} ${type}`, type, stat }));

/** The hero with its skills derived from its `build` (no build: no skills, so the normal attack). */
export const withSkills = hero => ({ ...hero, skills: skillsFor(hero.build) });
