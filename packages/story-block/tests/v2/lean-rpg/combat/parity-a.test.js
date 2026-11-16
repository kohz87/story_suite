// Sim parity, scenario A (one hero against one standard foe): seeded Monte Carlo, 3000 runs per cell through the real engine, against sim-results-v8.1.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkScenarios } from './combat-parity.helper.js';

test('scenario A (one hero against one standard foe) matches v8.1: win within 3.0 points, exchanges within 0.2, none unfinished, band counts equal', () => {
    assert.ok(checkScenarios(assert, ['A']) > 0);
});
