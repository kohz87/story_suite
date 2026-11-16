// The band fixture (band.fixture.js, built from sim-results-v8.1.md) is whole and agrees with itself and with the oracle:
// 120 cells (A-G) plus 108 for 4-6 foes (H-J), the role bands (A-G and the locked H-J bands) recount to the results file's own in-band numbers, every derived character and foe row
// equals the oracle's formulas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, BANDS_MANY, BAND_RUNS, BAND_RUNS_MANY, BAND_SOURCE_SHA256, CELLS, FOES, SHEET } from './band.fixture.js';
import { barsOf, foeOf, simMasteryAt } from './oracle.js';

const LEVELS = [1, 15, 30, 50, 75, 99];
const cellsOf = (sc, row) => CELLS.filter(c => c[0] === sc && c[1] === row).sort((x, y) => x[2] - y[2]);

test('228 cells: A-G (120, 3000 runs) and H-J (108, 10000 runs), six levels each, nothing unfinished', () => {
    assert.equal(BAND_RUNS, 3000);
    assert.equal(BAND_RUNS_MANY, 10000);
    assert.match(BAND_SOURCE_SHA256, /^[0-9a-f]{64}$/);
    assert.equal(CELLS.length, 228);
    const keys = new Set(CELLS.map(c => c.slice(0, 3).join('|')));
    assert.equal(keys.size, 228);
    const perScenario = Object.fromEntries('ABCDEFGHIJ'.split('').map(s => [s, CELLS.filter(c => c[0] === s).length]));
    assert.deepEqual(perScenario, { A: 36, B: 18, C: 12, D: 36, E: 6, F: 6, G: 6, H: 36, I: 36, J: 36 });
    for (const [, , lv, win, unf, ex, hp, tempo, sp, mp] of CELLS) {
        assert.ok(LEVELS.includes(lv));
        assert.ok(win >= 0 && win <= 100 && hp >= 0 && hp <= 100 && sp <= 100 && mp <= 100);
        assert.equal(unf, 0);
        assert.ok(ex >= 1 && tempo >= 0);
    }
});

test('4-6 foes: more foes never help; a trivial group is won, an elite group is not; the Healer party does better', () => {
    const win = (sc, row, lv) => CELLS.find(c => c[0] === sc && c[1] === row && c[2] === lv)[3];
    for (const lv of LEVELS) {
        for (const party of ['W+S+M', 'W+S+H']) {
            const std = ['H', 'I', 'J'].map(sc => win(sc, `${party} vs standard`, lv));
            assert.ok(std[0] > std[1] && std[1] > std[2], `${party} L${lv} ${std}`);
            for (const sc of 'HIJ') assert.ok(win(sc, `${party} vs minion`, lv) >= 90 && win(sc, `${party} vs elite`, lv) < 25);
        }
        for (const sc of 'HIJ') assert.ok(win(sc, 'W+S+H vs standard', lv) > win(sc, 'W+S+M vs standard', lv));
    }
});

test('locked 4-6-foe bands (owner decision 48): 18 rows recount to the printed numbers; 89 of 108 cells in band, 19 standard cells out', () => {
    assert.equal(BANDS_MANY.length, 18);
    const band = (sc, row) => BANDS_MANY.find(b => b[0] === sc && b[1] === row).slice(2, 4);
    assert.deepEqual(['H', 'I', 'J'].map(sc => band(sc, 'W+S+M vs standard')), [[70, 85], [35, 55], [15, 30]]);
    for (const sc of 'HIJ') for (const p of ['W+S+M', 'W+S+H']) {
        assert.deepEqual(band(sc, `${p} vs minion`), [90, 100]);
        assert.deepEqual(band(sc, `${p} vs elite`), [0, 24.99]);
    }
    let inBand = 0;
    let outStandard = 0;
    for (const [sc, row, lo, hi, printed] of BANDS_MANY) {
        const wins = cellsOf(sc, row).map(c => c[3]);
        assert.equal(wins.length, 6, `${sc} ${row}`);
        const n = wins.filter(w => w >= lo && w <= hi).length;
        inBand += n;
        if (row.endsWith('standard')) outStandard += 6 - n;
        assert.equal(printed, `${n}/6`, `${sc} ${row}`);
    }
    assert.equal(inBand, 89);
    assert.equal(outStandard, 19);
});

test('v8.1 has no Evasion+Movement rows: Skirmisher is Evasion, Skirmisher-Move is Movement', () => {
    const rows = new Set(CELLS.map(c => c[1]));
    assert.ok(rows.has('Skirmisher') && rows.has('Skirmisher-Move') && rows.has('Skirmisher-area'));
    assert.ok(!rows.has('Skirmisher-noMove'));
});

test('the 17 role bands recount to the in-band numbers the results file prints', () => {
    assert.equal(BANDS.length, 17);
    let inBand = 0;
    for (const [sc, row, lo, hi, printed] of BANDS) {
        const wins = cellsOf(sc, row).map(c => c[3]);
        assert.equal(wins.length, 6, `${sc} ${row}`);
        const n = wins.filter(w => w >= lo && w <= hi).length;
        inBand += n;
        // the file prints win % to one decimal for the band test and whole numbers in the table; the count is the band test's
        assert.equal(printed, `${n}/6`, `${sc} ${row}`);
    }
    assert.equal(inBand, 47);
});

test('every derived character equals the oracle: bars, mastery, hit bonus', () => {
    assert.equal(SHEET.length, 24);
    for (const [build, lv, str, vit, agi, dex, int, wis, hp, sp, mp, hit, rank] of SHEET) {
        const bars = barsOf({ str, vit, agi, dex, int, wis }, lv);
        assert.deepEqual([hp, sp, mp], [bars.hp, bars.sp, bars.mp], `${build} L${lv}`);
        const physical = Math.floor(dex / 2) + Math.floor(lv / 4);
        const magic = Math.floor(wis / 2) + Math.floor(lv / 4);
        assert.equal(hit, build === 'Mage' || build === 'Healer' ? magic : physical, `${build} L${lv}`);
        assert.ok(rank.includes(`+${simMasteryAt(lv)},`), `${build} L${lv} ${rank}`);
    }
});

test('every foe row equals the oracle: HP, damage, roll', () => {
    assert.equal(FOES.length, 24);
    for (const [tier, lv, hp, dmg, roll] of FOES) {
        const fo = foeOf(tier, lv);
        assert.deepEqual([hp, dmg, roll], [fo.hp, fo.dmg, fo.roll], `${tier} L${lv}`);
    }
});
