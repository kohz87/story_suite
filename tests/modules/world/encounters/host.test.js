// Encounters on the real host: off by default (nothing recorded, nothing told); on, the roll rides the reply as a recorded prelude, so a
// swipe, a rebuild, a middle delete and a fresh load agree with live; a backdrop person the reply names with a `+ npc` line is promoted
// (a stand-in people module makes the dossier), and a swipe or a rewind of that reply takes the promotion back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { ENCOUNTERS_FEATURE, overrideBackdrops } from '../../../../modules/world/encounters/index.js';

const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PACK = JSON.stringify({ id: 'enc', version: '1.0.0', name: 'Encounters', format: 4, kind: 'world', requires: { suite: '^0.1' },
    content: { places: [{ name: 'Bluewatch Village', region: 'The March', x: 0, y: 0, kind: 'capital' }] } });
const FERRY = [{ id: 'ferryman', who: 'the ferryman', look: 'a lean man poling the barge', at: ['bluewatch village'], weight: 10 }];

// A stand-in for NPC State's line: `+ npc Name | role` makes the dossier `{ id, name, role }` through the people domain's own `people.stub`
// (the real NPC State line is tested in tests/people).
const PEOPLE = {
    id: 'people-standin', name: 'people stand-in', version: '0.0.0',
    capture: {
        kinds: { npc: { grammar: '+ npc <name> | <role>' } },
        apply(ctx, line) {
            const name = String(line.name ?? '').trim();
            const role = String(line.raw ?? line.text ?? '').split('|')[1]?.trim() ?? '';
            const id = `npc_${name.toLowerCase()}`;
            ctx.call('people.stub', { id, record: { id, name, role } });
            return { summary: `${name} is new.`, narrate: false };
        },
    },
};

async function newHost(on) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [PEOPLE, module] });
    if (on) host.features.set(ENCOUNTERS_FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return host;
}
const ledger = host => host.head().domains.director.encounters?.[0] ?? null;
const receipts = host => host.sdk.receipts().filter(entry => entry.receipt.type.startsWith('director.encounter'));
const begin = host => host.send('Begin.', reply('Mist.', ['~ time June 3, 1200, 08:00 am', '~ place Bluewatch Village']));

async function agrees(host, label) {
    assert.deepEqual(host.store.problems(), [], `${label}: no store problems`);
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await newHost(true);
    try {
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.deepEqual(ledger(again), ledger(host), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}

test('off by default: no step, no record, no line', async () => {
    const undo = overrideBackdrops(() => FERRY);
    const host = await newHost(false);
    try {
        assert.equal(host.features.on(ENCOUNTERS_FEATURE), false);
        await begin(host);
        await host.send('Wait.', reply('The barge.', ['~ time June 3, 1200, 09:00 am']));
        assert.equal(ledger(host), null);
        assert.deepEqual(receipts(host), []);
    } finally { host.close(); undo(); }
});

test('on: one encounter a place and part of the day, told on the reply; swipes, a rebuild, a middle delete and a fresh load agree', async () => {
    const undo = overrideBackdrops(() => FERRY);
    const host = await newHost(true);
    try {
        await begin(host);
        await host.send('Wait.', reply('The barge comes.', ['~ time June 3, 1200, 09:00 am']));
        const first = ledger(host).results.at(-1);
        assert.equal(first.kind, 'backdrop');
        assert.equal(first.ref, 'ferryman');
        const told = receipts(host).at(-1).receipt;
        assert.match(told.summary, /^Encounter this reply: the ferryman \(Bluewatch Village\)/);
        await host.send('Still.', reply('Gulls.', ['~ time June 3, 1200, 01:00 pm']));
        assert.equal(receipts(host).at(-1).receipt.data.skipped, 'told', 'the same morning: told once');
        await host.send('Noon.', reply('Noon.', ['~ time June 3, 1200, 03:00 pm']));
        const noon = ledger(host).results.at(-1);
        await agrees(host, 'live');
        const before = JSON.stringify(ledger(host));
        await host.swipe(reply('Noon, grey.', ['~ time June 3, 1200, 03:00 pm']));
        assert.equal(JSON.stringify(ledger(host)), before, 'a swipe rolls the same day, place and part of the day the same way');
        assert.deepEqual(ledger(host).results.at(-1), noon);
        await agrees(host, 'swipe');
        const at = host.ctx.chat.findIndex(message => message.is_user && message.mes === 'Still.');
        await host.st.deleteMessage(at + 1);
        await host.st.deleteMessage(at);
        await agrees(host, 'middle delete');
    } finally { host.close(); undo(); }
});

test('promotion: the reply names the ferryman with a `+ npc` line; later rolls use the person; a swipe and a rewind take it back', async () => {
    const undo = overrideBackdrops(() => FERRY);
    const host = await newHost(true);
    try {
        await begin(host);
        await host.send('Who are you?', reply('"Oskar," the ferryman says.', ['~ time June 3, 1200, 09:00 am', '+ npc Oskar | ferryman']));
        assert.equal(ledger(host).results.at(-1).ref, 'ferryman', 'the ferryman was this reply\'s encounter');
        assert.deepEqual(ledger(host).bound, { ferryman: { key: 'npc_oskar', name: 'Oskar', at: host.ctx.chat.length - 1 } });
        assert.equal(receipts(host).at(-1).receipt.summary, 'Oskar is now in People (was the ferryman).');
        await agrees(host, 'promoted');
        // The clock the roll reads is the one before the reply: 'Noon.' still rolls in the morning (told), 'Later.' at midday.
        await host.send('Noon.', reply('Noon.', ['~ time June 3, 1200, 01:00 pm']));
        await host.send('Later.', reply('Later.', ['~ time June 3, 1200, 03:00 pm']));
        const later = ledger(host).results.at(-1);
        assert.equal(later.key.endsWith('|midday'), true);
        assert.equal(later.ref, 'ferryman', 'the seeded midday roll lands on the ferryman (weight 10 of 14)');
        assert.equal(later.name, 'Oskar');
        assert.match(receipts(host).filter(entry => entry.receipt.type === 'director.encounter').at(-1).receipt.summary, /^Encounter this reply: Oskar, the ferryman \(Bluewatch Village\)\./);
        // A rewind to the promoting reply keeps it; a swipe of it that names no one takes it back.
        const ask = host.ctx.chat.findIndex(message => message.is_user && message.mes === 'Noon.');
        for (let i = host.ctx.chat.length - 1; i >= ask; i -= 1) await host.st.deleteMessage(i);
        await agrees(host, 'rewind to the promotion');
        assert.equal(ledger(host).bound.ferryman.name, 'Oskar');
        await host.swipe(reply('The ferryman only nods.', ['~ time June 3, 1200, 09:00 am']));
        assert.deepEqual(ledger(host).bound, {}, 'a swipe that names no one takes the promotion back');
        await agrees(host, 'swiped');
    } finally { host.close(); undo(); }
});
