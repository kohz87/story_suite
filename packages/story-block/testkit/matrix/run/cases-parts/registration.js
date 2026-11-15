// Matrix cases for module registration: SD disabled, late registration and duplicate name.

import assert from 'node:assert/strict';
import { MODULES, ORDER } from '../../modules.js';
import { activeOf, keysOf, label, withHost, factsOf, play, runSetups, queryNames } from '../host.js';
import { checkRegistered, changed, dormancy, gapNote, noProblems, oracle, replayed } from '../checks.js';
import { na } from './shared-na.js';

async function disabledSd(env, row, rec) {
    await rec.step('disabled-sd', async () => {
        if (!row.modules.includes('sd')) return na('there is no SD in this row to disable');
        const held = row.modules.filter(key => key === 'sd');
        const active = row.modules.filter(key => !held.includes(key));
        await withHost(env, row.modules, {}, async host => {
            const domains = host.sdk.modules().filter(entry => held.some(key => MODULES[key].id === entry.id)).flatMap(entry => entry.domains);
            const saved = () => structuredClone(Object.fromEntries(domains.map(domain => [domain, host.head().domains[domain]])));
            const disable = async () => {
                assert.equal(host.registry.setEnabled(MODULES.sd.id, false, 'Matrix: SD disabled.'), true);
                for (const key of held) {
                    await dormancy(host, key, 'with SD disabled');
                    assert.ok(host.registry.contexts().every(entry => entry.moduleId !== MODULES[key].id), `${label(key)} still supplies prompts`);
                    const def = env.loaded[key].make(host.ref);
                    for (const hook of Object.keys(def.hooks ?? {})) {
                        assert.ok(host.registry.hookEntries(hook).every(entry => entry.moduleId !== def.id), `${label(key)} still supplies ${hook}`);
                    }
                    for (const kind of Object.keys(def.capture?.kinds ?? {})) assert.equal(host.registry.capture(kind), null, `${label(key)} still captures ${kind}`);
                }
                const refused = await host.sdk.command('threads.offer', {
                    write: 'wr_disabled', thread: 'th_disabled', kind: 'hook', key: 'Disabled goal',
                    summary: '', fields: {}, expectedHash: null,
                });
                assert.equal(refused.code, 'DEPENDENCY_UNAVAILABLE');
            };
            // Disable before the other modules play.
            await disable();
            const initial = factsOf(host, active);
            const before = saved();
            await play(host, active, 'A');
            changed(initial, factsOf(host, active), active, 'a reply with SD disabled');
            assert.deepEqual(saved(), before, 'disabled modules changed their saved slices');
            noProblems(host);
            replayed(host, ' (SD disabled before setup)');
            host.registry.setEnabled(MODULES.sd.id, true);
            checkRegistered(host, row);
            await runSetups(host, activeOf(row));
            await play(host, activeOf(row), 'B');
            noProblems(host);
            // Disable a second time with real saved state, then reactivate without resetting it.
            const established = saved();
            await disable();
            await play(host, active, 'C');
            assert.deepEqual(saved(), established, 'disabling SD must preserve initialized slices');
            noProblems(host);
            replayed(host, ' (SD disabled with saved state)');
            host.registry.setEnabled(MODULES.sd.id, true);
            checkRegistered(host, row);
            assert.deepEqual(saved(), established, 'reactivation reset saved state');
        });
    });
}

async function lateRegistration(env, row, rec) {
    await rec.step('late', async () => {
        const order = ORDER.filter(key => row.modules.includes(key));
        const late = order.at(-1);
        if (!late) return na('SB alone has no module to register late');
        const early = row.modules.filter(key => key !== late);
        const activeEarly = await withHost(env, row.modules, { withhold: [late] }, host => early.filter(key => {
            const entry = host.sdk.modules().find(item => item.id === MODULES[key].id);
            return entry?.status ? entry.status === 'ready' : !row.dormant.includes(key);
        }));
        const active = activeOf(row);
        const expected = await oracle(env, row, [{ set: 'A', keys: activeEarly }, { set: 'B' }]);
        const gaps = [];
        await withHost(env, row.modules, { withhold: [late] }, async host => {
            await runSetups(host, activeEarly);
            await play(host, activeEarly, 'A');
            const before = factsOf(host, activeEarly);
            await host.sdk.registerModule(env.loaded[late].make(host.ref));
            const ids = host.sdk.modules().map(entry => entry.id);
            assert.equal(ids.filter(id => id === MODULES[late].id).length, 1, `${label(late)} is not listed exactly once after a late registration (${ids.join(', ')})`);
            assert.deepEqual(factsOf(host, activeEarly), before, 'registering a module changed what the others keep');
            noProblems(host);
            if (row.dormant.includes(late)) gaps.push((await dormancy(host, late, 'when registered late'))?.gap);
            else await runSetups(host, active.filter(key => !activeEarly.includes(key)));
            await play(host, active, 'B');
            noProblems(host);
            assert.deepEqual(factsOf(host, active), expected, 'a late registration should end where a boot with all of them does');
            replayed(host);
        });
        return gapNote(gaps.filter(Boolean));
    });
}

async function duplicateName(env, row, rec) {
    await rec.step('duplicate', async () => {
        const active = activeOf(row);
        const notes = [];
        await withHost(env, row.modules, {}, async host => {
            const before = host.sdk.modules().map(entry => entry.id);
            for (const key of row.modules) {
                await assert.rejects(() => host.sdk.registerModule(env.loaded[key].make(host.ref)), /already registered/, `${label(key)} registered twice`);
            }
            for (const key of keysOf(row)) {
                const name = key === 'sb' ? 'scene.place' : queryNames(env, key)[0];
                const owner = MODULES[key].id;
                await assert.rejects(
                    () => host.sdk.registerModule({ id: 'matrix-clash', name: 'Clash', version: '1.0.0', queries: { [name]: () => 'taken' } }),
                    new RegExp(`already belongs to "${owner}"`),
                    `a second owner of ${name} should be refused`,
                );
            }
            assert.deepEqual(host.sdk.modules().map(entry => entry.id), before, 'a refused registration changed the module list');
            const initial = factsOf(host, active);
            await runSetups(host, active);
            await play(host, active, 'A');
            noProblems(host);
            changed(initial, factsOf(host, active), active, 'a reply after the refusals');
            replayed(host);
            notes.push(`${row.modules.length} ids and ${keysOf(row).length} claimed names refused`);
        });
        return { note: notes.join('; ') };
    });
}

export { disabledSd, lateRegistration, duplicateName };
