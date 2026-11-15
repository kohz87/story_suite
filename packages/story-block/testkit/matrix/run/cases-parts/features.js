// Matrix cases for module features and the story clock: feature off and unset clock.

import assert from 'node:assert/strict';
import { MODULES } from '../../modules.js';
import { activeOf, keysOf, label, withHost, factsOf, play, runSetups } from '../host.js';
import { changed, noProblems, replayed } from '../checks.js';
import { na } from './shared-na.js';

async function featureOff(env, row, rec) {
    await rec.step('feature-off', async () => {
        const active = activeOf(row);
        const notes = [];
        for (const key of keysOf(row)) {
            await withHost(env, row.modules, {}, async host => {
                const entry = host.sdk.modules().find(item => item.id === MODULES[key].id);
                const ids = entry?.features ?? [];
                if (!ids.length) { notes.push(`${label(key)} declares no features`); return; }
                for (const id of ids) {
                    host.features.set(id, false);
                    assert.equal(host.sdk.feature(id), false, `${id} did not turn off`);
                }
                const initial = factsOf(host, active);
                await runSetups(host, active);
                await play(host, active, 'A');
                noProblems(host);
                const others = active.filter(other => other !== key);
                changed(initial, factsOf(host, active), key === 'sb' ? others : [...others], `a reply with ${label(key)}'s features off, for the others,`);
                replayed(host, ` (${label(key)} features off)`);
                for (const id of ids) host.features.set(id, true);
                await play(host, active, 'B');
                noProblems(host);
                replayed(host, ` (${label(key)} features back on)`);
            });
        }
        return notes.length ? { note: notes.join('; ') } : undefined;
    });
}

async function unsetClock(env, row, rec) {
    await rec.step('unset-clock', async () => {
        if (!row.modules.includes('sd')) return na('there is no story clock without SD');
        const active = activeOf(row);
        const quiet = keysOf(row, active).flatMap(key => MODULES[key].A.filter(line => !line.startsWith('~ time')));
        return withHost(env, row.modules, {}, async host => {
            await runSetups(host, active);
            await host.send('Turn A.', `A reply with no time.\n\n<Changes>\n${quiet.join('\n')}\n</Changes>`);
            noProblems(host);
            assert.equal(host.head().domains.director.time.minutes, null, 'the clock should still be unset');
            assert.ok(MODULES.sd.facts(host).goals.length, 'SD should still create a neutral goal with the clock unset');
            const [type, payload] = await MODULES.sd.action(host);
            const accepted = await host.sdk.command(type, payload);
            assert.ok(accepted.ok, `neutral acceptance with the clock unset: ${accepted.message}`);
            const goal = host.sdk.query('director.thread', { id: payload.thread });
            assert.ok(goal.acceptance, 'neutral acceptance should retain its evidence without time');
            assert.equal(goal.acceptance.minute, null);
            assert.equal(goal.rpg, undefined, 'a neutral goal needs no RPG extension');
            replayed(host);
            return { note: 'creation and views work with the clock unset' };
        });
    });
}

export { featureOff, unsetClock };
