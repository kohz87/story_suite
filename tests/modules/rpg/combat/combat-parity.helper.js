// Test-only simulator parity kit: the v8.1 derived builds, a Python-compatible seeded d20 stream and one cell runner.
// The seed and draw order are exactly sim.py's, so a matching engine reproduces its 3000-run row rather than merely nearing it.

import { crc32 } from 'node:zlib';
import { playBoard } from '../../../../modules/rpg/combat/play.js';
import { BANDS, CELLS } from '../v1/band.fixture.js';
import { withSkills } from './derived-skills.helper.js';

const N = 624, M = 397, MATRIX_A = 0x9908b0df, UPPER = 0x80000000, LOWER = 0x7fffffff;

/** Python random.Random(seed).randint(1, 20): MT19937, init_by_array, then five bits per draw with rejection. */
export class SimRandom {
    constructor(seedValue) {
        this.mt = new Uint32Array(N); this.index = N + 1;
        let seed = BigInt(seedValue), key = [];
        while (seed > 0n) { key.push(Number(seed & 0xffffffffn)); seed >>= 32n; }
        this.init(key.length ? key : [0]);
    }

    init(key) {
        this.mt[0] = 19650218;
        for (let i = 1; i < N; i += 1) { const p = this.mt[i - 1]; this.mt[i] = (Math.imul(1812433253, p ^ (p >>> 30)) + i) >>> 0; }
        let i = 1, j = 0;
        for (let k = Math.max(N, key.length); k > 0; k -= 1) {
            const p = this.mt[i - 1];
            this.mt[i] = ((this.mt[i] ^ Math.imul(p ^ (p >>> 30), 1664525)) + key[j] + j) >>> 0;
            i += 1; j += 1;
            if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
            if (j >= key.length) j = 0;
        }
        for (let k = N - 1; k > 0; k -= 1) {
            const p = this.mt[i - 1];
            this.mt[i] = ((this.mt[i] ^ Math.imul(p ^ (p >>> 30), 1566083941)) - i) >>> 0;
            i += 1;
            if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
        }
        this.mt[0] = UPPER;
    }

    twist() {
        for (let i = 0; i < N; i += 1) {
            const y = (this.mt[i] & UPPER) | (this.mt[(i + 1) % N] & LOWER);
            this.mt[i] = this.mt[(i + M) % N] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
        }
        this.index = 0;
    }

    next() {
        if (this.index >= N) this.twist();
        let y = this.mt[this.index++];
        y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18;
        return y >>> 0;
    }

    d20() {
        let value;
        do value = this.next() >>> 27; while (value >= 20);
        return value + 1;
    }
}

const STATS = ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha'];
const BUILDS = {
    Warrior: { creation: { str: 10, dex: 10 }, prio: ['str', 'dex', 'vit', 'agi'] },
    Skirmisher: { creation: { agi: 10, dex: 10 }, prio: ['agi', 'dex', 'vit', 'str'] },
    'Skirmisher-Move': { creation: { agi: 10, dex: 10 }, prio: ['agi', 'dex', 'vit', 'str'] },
    'Skirmisher-plain': { creation: { agi: 10, dex: 10 }, prio: ['agi', 'dex', 'vit', 'str'] },
    'Skirmisher-area': { creation: { agi: 10, dex: 10 }, prio: ['agi', 'dex', 'vit', 'str'] },
    Mage: { creation: { int: 10, wis: 10 }, prio: ['int', 'wis', 'vit', 'agi'] },
    Healer: { creation: { wis: 10, vit: 10 }, prio: ['wis', 'vit', 'int', 'agi'] },
};
const STANCES = {
    Warrior: ['defence'], Skirmisher: ['evasion'], 'Skirmisher-Move': ['movement'], 'Skirmisher-plain': [],
    'Skirmisher-area': ['evasion'], Mage: ['evasion'], Healer: ['defence'],
};
const MASTERY = { 1: 1, 15: 3, 30: 4, 50: 5, 75: 6, 99: 7 };

export function statsAt(build, level) {
    const spec = BUILDS[build], stats = Object.fromEntries(STATS.map(key => [key, 5]));
    Object.assign(stats, spec.creation);
    const fallback = STATS.filter(key => !spec.prio.includes(key));
    let round = 0;
    for (let left = level - 1; left > 0; left -= 1) {
        if (spec.prio.some(key => stats[key] < 30)) {
            while (stats[spec.prio[round % spec.prio.length]] >= 30) round += 1;
            stats[spec.prio[round++ % spec.prio.length]] += 1;
        } else stats[fallback.find(key => stats[key] < 30)] += 1;
    }
    return stats;
}

function hero(build, level, label = build) {
    const stats = statsAt(build, level), bars = {
        hp: 5 + Math.floor(level / 3) + Math.floor(stats.vit / 2),
        mp: 8 + Math.floor(level / 4) + Math.floor((stats.int + stats.wis) / 4),
        sp: 8 + Math.floor(level / 4) + Math.floor((stats.str + stats.agi) / 4),
    };
    return withSkills({ label, build, level, stats, mastery: MASTERY[level], hp: bars.hp, maxHp: bars.hp, mp: bars.mp, maxMp: bars.mp, sp: bars.sp, maxSp: bars.sp, stances: STANCES[build] });
}

const PARTIES = {
    A: row => [row], B: row => [row], D: row => [row], E: () => ['Warrior', 'Healer'], F: () => ['Warrior', 'Mage'],
};
const FOES = { A: ['standard', 1], B: ['standard', 3], D: ['elite', 1], E: ['elite', 1], F: ['elite', 1] };

function sheetFor(cell) {
    const [scenario, row, level] = cell, members = PARTIES[scenario](row), [tier, count] = FOES[scenario];
    return {
        party: members.map((build, index) => hero(build, level, members.length > 1 ? build : `hero-${index}`)),
        foes: Array.from({ length: count }, (_, index) => ({ id: `foe-${index}`, label: tier, tier, level })),
    };
}

/** Every A/B/D/E/F cell from the v8.1 fixture: [scenario, row, level, win %, unfinished %, mean exchanges]. */
export const PARITY_CELLS = CELLS.filter(cell => 'ABDEF'.includes(cell[0]));

/** Run one fixture cell through the real engine with the simulator's seed and draw order. */
export function runCell(cell, runs = 3000) {
    const [scenario, row, level] = cell, random = new SimRandom(crc32(`${scenario}-${row}|${level}`));
    let wins = 0, unfinished = 0, exchanges = 0;
    for (let run = 0; run < runs; run += 1) {
        const result = playBoard(sheetFor(cell), { random: () => random.d20(), maxExchanges: 60 });
        if (result.result === 'win') wins += 1;
        if (result.result === 'unfinished') unfinished += 1;
        exchanges += result.exchanges;
    }
    return { win: 100 * wins / runs, unfinished: 100 * unfinished / runs, exchanges: exchanges / runs, runs };
}

/** Check every cell of the given scenarios against the v8.1 fixture: win ±3.0 points, mean exchanges ±0.2, nothing unfinished, band counts equal. */
export function checkScenarios(assert, scenarios) {
    const mine = PARITY_CELLS.filter(cell => scenarios.includes(cell[0])), found = new Map();
    for (const cell of mine) {
        const [scenario, row, level, win, , exchanges] = cell, got = runCell(cell), name = `${scenario} ${row} L${level}`;
        assert.ok(Math.abs(got.win - win) <= 3.0, `${name}: win ${got.win.toFixed(1)} vs ${win}`);
        assert.ok(Math.abs(got.exchanges - exchanges) <= 0.2, `${name}: exchanges ${got.exchanges.toFixed(2)} vs ${exchanges}`);
        assert.equal(got.unfinished, 0, `${name}: unfinished fights`);
        const key = `${scenario}|${row}`;
        found.set(key, [...(found.get(key) ?? []), got.win]);
    }
    for (const [scenario, row, low, high, counted] of BANDS.filter(band => scenarios.includes(band[0]))) {
        const wins = found.get(`${scenario}|${row}`), inBand = wins.filter(win => win >= low && win <= high).length;
        assert.equal(`${inBand}/${wins.length}`, counted, `${scenario} ${row}: cells in band`);
    }
    return mine.length;
}
