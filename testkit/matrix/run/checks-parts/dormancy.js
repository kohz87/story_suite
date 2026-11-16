// Dormancy probe for the matrix runner and the gap notes it reports.

import assert from 'node:assert/strict';
import { MODULES } from '../../modules.js';

const gap = detail => ({ gap: detail });

/** Whether module `key` is dormant on `host`. A real status is strict; before the lifecycle exists it is a gap. */
async function dormancy(host, key, why, { probe = false } = {}) {
    const spec = MODULES[key];
    const entry = host.sdk.modules().find(item => item.id === spec.id);
    assert.ok(entry, `${spec.label} is not registered`);
    if (Object.hasOwn(entry, 'status')) {
        assert.equal(entry.status, 'dormant', `${spec.label} should be dormant ${why}`);
        assert.ok(typeof entry.reason === 'string' && entry.reason.trim(), `${spec.label} is dormant but says no reason`);
        if (spec.setup) {
            let refused = false;
            try { await spec.setup(host); } catch { refused = true; }
            assert.ok(refused, `${spec.label} is dormant but still ran its setup command`);
        }
        return null;
    }
    let held = '';
    if (probe) {
        const sent = await host.send('Turn.', 'A quiet reply.');
        if (sent.aborted) held = `; the reader's first message is held back (${host.st.notices.map(item => `"${item.reason}"`).join(', ') || 'no reason given'})`;
    }
    let works = false;
    try { await spec.setup?.(host); works = true; } catch { works = false; }
    return gap(`${spec.label} is not dormant ${why}: sdk.modules() has no status yet, its setup command ${works ? 'ran' : 'was refused'}${held}`);
}

const gapNote = gaps => (gaps.length ? gap([...new Set(gaps)].join('; ')) : undefined);

export { gap, dormancy, gapNote };
