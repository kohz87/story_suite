// Registration and held-back-message probes of a matrix host.

import assert from 'node:assert/strict';
import { MODULES } from '../../modules.js';
import { keysOf, label, withHost } from '../host.js';

function checkRegistered(host, row) {
    const modules = host.sdk.modules();
    const ids = modules.map(entry => entry.id);
    assert.equal(new Set(ids).size, ids.length, `a module is listed twice: ${ids.join(', ')}`);
    for (const key of keysOf(row)) {
        const entry = modules.find(item => item.id === MODULES[key].id);
        assert.ok(entry, `${label(key)} is not registered (have ${ids.join(', ')})`);
        if (Object.hasOwn(entry, 'status') && !row.dormant.includes(key)) assert.equal(entry.status, 'ready', `${label(key)} should be ready`);
    }
    assert.equal(ids.length, keysOf(row).length, `expected ${keysOf(row).length} modules, have ${ids.join(', ')}`);
    assert.deepEqual(host.st.notices, [], 'a generation was held back at boot');
}


/**
 * For a negative row: why the other modules cannot work yet, or null. Only while the host has no module
 * status (no lifecycle) and a dormant-to-be module still holds the reader's first message back.
 */
async function heldBack(env, row) {
    return withHost(env, row.modules, {}, async host => {
        if (host.sdk.modules().some(entry => Object.hasOwn(entry, 'status'))) return null;
        const sent = await host.send('Turn.', 'A quiet reply.');
        if (!sent.aborted) return null;
        const who = row.dormant.map(key => label(key)).join(', ');
        return `${who} is not dormant yet and holds the reader's first message back (${host.st.notices.map(item => `"${item.reason}"`).join(', ')})`;
    });
}

export { checkRegistered, heldBack };
