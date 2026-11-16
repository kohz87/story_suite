// Test-only: the example builds of the combat page. Start 5 each, the creation points, then one point per level
// round-robin over the build's priority stats (cap 30); points beyond the cap go to CHA, which feeds no bar.

const KEYS = ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha'];

export const BUILDS = {
    Warrior: { creation: { str: 10, dex: 10 }, prio: ['str', 'dex', 'vit', 'agi'] },
    Skirmisher: { creation: { agi: 10, dex: 10 }, prio: ['agi', 'dex', 'vit', 'str'] },
    Mage: { creation: { int: 10, wis: 10 }, prio: ['int', 'wis', 'vit', 'agi'] },
    Healer: { creation: { wis: 10, vit: 10 }, prio: ['wis', 'vit', 'int', 'agi'] },
};

export function statsAt(build, level) {
    const s = Object.fromEntries(KEYS.map(k => [k, 5]));
    Object.assign(s, build.creation);
    for (let i = 0, left = level - 1; left > 0; left--) {
        const open = build.prio.filter(k => s[k] < 30);
        if (!open.length) { s.cha += 1; continue; }
        while (s[build.prio[i % build.prio.length]] >= 30) i++;
        s[build.prio[i++ % build.prio.length]] += 1;
    }
    return s;
}
