// Matrix cases for peer modules that are absent from a row: the missing query and the malformed answer.

import assert from 'node:assert/strict';
import { activeOf, label, withHost, factsOf, play, runSetups, queryNames, hostilePeer } from '../host.js';
import { changed, dormancy, gapNote, noProblems, replayed } from '../checks.js';
import { na } from './shared-na.js';

async function missingQuery(env, row, rec) {
    await rec.step('missing-query', async () => {
        const absent = ['sd', 'nsd'].filter(key => !row.modules.includes(key));
        if (!absent.length) return na('every peer is in this row');
        const active = activeOf(row);
        await withHost(env, row.modules, {}, async host => {
            for (const key of absent) {
                for (const name of queryNames(env, key)) {
                    assert.throws(() => host.sdk.query(name), /no module answers the query/, `${name} (${label(key)}, absent) should be an unknown query`);
                }
            }
            assert.throws(() => host.sdk.query('matrix.nothing'), /no module answers the query/);
            const initial = factsOf(host, active);
            await runSetups(host, active);
            await play(host, active, 'A');
            noProblems(host);
            changed(initial, factsOf(host, active), active, 'a reply after the missing queries');
            replayed(host);
        });
    });
}

async function malformed(env, row, rec) {
    await rec.step('malformed', async () => {
        const absent = ['sd', 'nsd'].filter(key => !row.modules.includes(key));
        if (!absent.length) return na('every peer is in this row');
        const active = activeOf(row);
        const gaps = [];
        const tally = { asked: 0 };
        for (const peer of absent) {
            for (const mode of ['throws', 'null', 'garbage']) {
                const where = `${label(peer)} stand-in answering "${mode}"`;
                try {
                    await withHost(env, row.modules, { extra: [hostilePeer(env, peer, mode, tally)] }, async host => {
                        const initial = factsOf(host, active);
                        await runSetups(host, active);
                        await play(host, active, 'A');
                        noProblems(host);
                        changed(initial, factsOf(host, active), active, 'a reply');
                        replayed(host);
                        const errors = host.noise.filter(([level]) => level === 'error');
                        assert.deepEqual(errors, [], 'console errors');
                        if (peer === 'sd') for (const key of row.dormant) gaps.push((await dormancy(host, key, `with a malformed ${label(peer)}`))?.gap);
                    });
                } catch (error) {
                    throw new Error(`${where}: ${error.message}`);
                }
            }
        }
        return gapNote(gaps.filter(Boolean)) ?? { note: `${absent.map(label).join(', ')} stood in 3 ways each; the modules asked ${tally.asked} times` };
    });
}

export { missingQuery, malformed };
