import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { runtimeSource } from './helpers/runtime-source.js';

const change = { impact: 'meaningful', delta: { trust: 3, affection: 0, desire: 0, tension: 2 }, reason: 'She trusted him with the key.', message: 14 };

test('v1.2.15 settings fold the rarely touched ones under Advanced', () => {
    const index = runtimeSource();
    const advanced = index.match(/const advanced = \[([\s\S]*?)\]\.join\(''\);/)?.[1] ?? '';
    for (const id of ['npc_state_delta_scan_depth', 'npc_state_delta_inject_budget', 'npc_state_delta_mid_delete_rewind', 'npc_state_delta_branch_rescan']) {
        assert.ok(advanced.includes(`'${id}'`), `${id} is under Advanced`);
        assert.equal(index.split(`settingRow('${id}'`).length - 1, 1, `${id} appears once`);
    }
    const scannerOutput = fs.readFileSync(new URL('../../modules/people/settings/scanner-output.js', import.meta.url), 'utf8');
    assert.match(scannerOutput, /#npc_state_delta_scan_depth'\)\?\.closest\?\.\('label'\)[\s\S]*after\.after\(row\)/, 'Maximum output tokens is drawn under Advanced, right after Scan context');
    assert.match(index, /settingsGroup\('advanced', 'Advanced', /);
});
