// `chronicle.lasting` on the real Story Block v2 host (the live runtime and testkit): a pack can require the capability Story Director
// declares (`chronicle-lasting`), and a world line's factions tag makes the faction (the reply carries the factionTags mark; a Re-read,
// a rebuild and a reload agree; an old unmarked reply makes none). The dated events of format 3 packs that wrote lasting changes through
// `then` steps are gone with that format: a world pack's events are `worldEvents`, covered by the daily-host tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { packsFor } from '../../../../core/runtime.js';
import { stCapabilities } from '../../../../packs/st-adapter.js';
import { createModule } from '../../../../modules/director/module.js';
import { validateChronicle } from '../../../../modules/world/chronicle/domain.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);

async function newHost() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [fakeFightRunner(), module] });
    return host;
}

// ---- the capability a pack can require --------------------------------------------------------------

const NEEDS_LASTING = {
    id: 'needs-lasting', format: 4, kind: 'world', version: '1.0.0', name: 'Needs lasting', requires: { suite: '^0.1', capabilities: ['chronicle-lasting'] },
    content: { places: [{ id: 'highmark', name: 'Highmark', region: 'The March', x: 0, y: 0 }] },
};

// Story Block checks `requires.capabilities` against the running modules' declared names (st-adapter.js, the check the
// live host uses; the testkit host leaves it off, so the packs part is built here with it on, over the host's settings).
async function withBlock(host, run) {
    globalThis.StoryBlock = { sdk: host.sdk };
    try { return await run(packsFor(host.ctx, { capabilities: stCapabilities })); } finally { delete globalThis.StoryBlock; }
}

test('on the host: Story Director declares chronicle-lasting, so a pack that requires it installs; without Story Director the reader is told what is missing', async () => {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    assert.deepEqual(module.capabilities, ['chronicle-lasting']);
    host = await createHost({ modules: [fakeFightRunner(), module] });
    assert.deepEqual(host.sdk.modules().find(entry => entry.id === 'story-director').capabilities, ['chronicle-lasting']);
    const saved = await withBlock(host, async part => {
        assert.ok(stCapabilities().includes('chronicle-lasting'));
        const result = await part.packs.install(JSON.stringify(NEEDS_LASTING), { origin: 'pack.json' });
        assert.deepEqual([result.ok, result.action], [true, 'installed'], JSON.stringify(result));
        const [listed] = part.packs.list();
        assert.deepEqual([listed.enabled, listed.missing, listed.problem], [true, [], '']);
        return structuredClone(host.ctx.extensionSettings.storySuite);
    });
    host.close();

    // No Story Director: the same pack is turned away with the reason, and nothing is installed.
    const bare = await createHost({ modules: [] });
    await withBlock(bare, async part => {
        assert.equal(stCapabilities().includes('chronicle-lasting'), false);
        const result = await part.packs.install(JSON.stringify(NEEDS_LASTING), { origin: 'pack.json' });
        assert.equal(result.ok, false);
        assert.deepEqual(result.errors.map(error => [error.code, error.message]), [['MISSING_CAPABILITY', 'This pack needs chronicle-lasting, which no installed module provides.']]);
        assert.deepEqual(part.packs.list(), []);
    });
    bare.close();

    // A pack installed while Story Director was there and then opened without it is listed as missing the capability.
    const later = await createHost({ modules: [], settings: saved });
    await withBlock(later, async part => {
        const [listed] = part.packs.list();
        assert.deepEqual([listed.id, listed.missing], ['needs-lasting', ['chronicle-lasting']]);
    });
    later.close();
});

test('a world line\'s factions tag makes the faction on the host: the reply carries the factionTags mark, a Re-read, rebuild and reload agree, an unmarked reply makes none', async () => {
    const host = await newHost();
    const recordOf = index => host.ctx.chat[index].extra.storySuite;
    const factionNames = () => host.sdk.query('chronicle.factions').map(faction => faction.name).sort();
    try {
        // An old reply (recorded before the rule: no mark) names a faction in a tag and makes none.
        const setRuleMarks = host.store.setRuleMarks;
        host.store.setRuleMarks = () => { throw new Error('no mark: an old chat'); };
        await host.send('Old.', reply('Fists fly.', ['+ world Dock Brawl — a fight on the quay | factions: Quay Watch']));
        host.store.setRuleMarks = setRuleMarks;
        const old = host.ctx.chat.length - 1;
        assert.equal(recordOf(old).rules, undefined);
        assert.deepEqual(factionNames(), []);

        // A new reply is marked, and its tag creates the factions.
        await host.send('New.', reply('Red cords on the quay.', ['+ world Bluewatch Street Clash — the gangs meet | factions: Red-Cord Gang, Quay Watch']));
        const at = host.ctx.chat.length - 1;
        assert.ok(recordOf(at).rules.includes('factionTags'));
        assert.deepEqual(factionNames(), ['Quay Watch', 'Red-Cord Gang']);
        assert.deepEqual(host.sdk.query('chronicle.faction', { name: 'Red-Cord Gang' }).events.map(event => event.name), ['Bluewatch Street Clash']);
        assert.deepEqual(validateChronicle(host.head().domains.chronicle), []);

        // Re-read, rebuild and reload give the same state; the unmarked reply stays unmarked and makes none.
        const live = JSON.stringify(host.head());
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.equal(JSON.stringify(host.head()), live, 'a Re-read');
        assert.equal((await host.turn.reread(old)).ok, true);
        assert.equal(recordOf(old).rules, undefined, 'the old reply gains no mark');
        assert.equal(JSON.stringify(host.head()), live, 'and no faction');
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'a rebuild');
        await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
        assert.equal(JSON.stringify(host.head()), live, 'a reload');
    } finally { host.close(); }
});
