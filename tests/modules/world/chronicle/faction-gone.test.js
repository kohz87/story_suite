// A `~ faction` line whose words say the group is finished ends it as `- faction` does, only on a reply with the `factionGone` rule mark.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { saysGone } from '../../../../modules/world/chronicle/capture/faction-gone.js';
import { factionNamed, line, lines, makeState, replay } from './helpers/fake-ctx.js';
import { readRecord } from '../../../../core/persist.js';

const OWNER = 'Ferrybend wrecker crew wiped out, one deckhand captured, and local buyer Brenn exposed';

test('words that say the group is finished', () => {
    for (const text of [OWNER, 'wiped out', 'Wiped out at Ferrybend.', 'The gang has been completely destroyed', 'disbanded after the raid', 'The Red Cord is no more; the crew disbanded.',
        'the Cord dissolved for good', 'broken up by the Watch', 'They were annihilated', 'The cult no longer exists', 'crushed and scattered', 'Red Cord has now been eliminated', 'exterminated']) {
        assert.equal(saysGone(text, ['Red Cord']), true, text);
    }
});

test('false positives stay', () => {
    for (const text of ['nearly wiped out', 'The crew was nearly wiped out', 'not destroyed', 'The gang is not yet destroyed', 'wasn’t destroyed', 'never disbanded', 'half the crew wiped out',
        'a destroyed wagon', 'Their warehouse destroyed, they regroup', 'destroyed the bridge at Ferrybend', 'The crew destroyed the toll house', 'crushed and scattered the raiders',
        'Red Cord wiped out the Salt Gang', 'a rival gang wiped out', 'wiped out by them', 'The crew will be destroyed', 'If the gang is destroyed the toll ends', 'Rumoured destroyed',
        'May have been disbanded?', 'part of the crew eliminated', 'one of the gang eliminated', 'Red Cord toll house destroyed', 'The Watch wants the gang destroyed', 'broken up over the loss',
        'buying up their debts after the crew was wiped out', 'hiring since the gang disbanded',
        'The old toll no longer exists', 'undestroyed', '']) {
        assert.equal(saysGone(text, ['Red Cord']), false, text);
    }
});

const MADE = '+ faction Red Cord — wreckers | Bluewatch Reach | stance: hostile';
const ENDED = `~ faction Red Cord — ${OWNER} | stance: hostile`;
const marked = { carrier: { rules: ['consumableRecovery', 'factionGone'] } };

test('with the mark the line removes the faction; without it the line updates it; both replay', () => {
    const initial = lines(makeState({ minutes: 1440 }), MADE, marked).state;
    const gone = lines(initial, ENDED, marked);
    assert.equal(factionNamed(gone.state, 'Red Cord'), undefined);
    assert.match(gone.runs.at(-1).result.summary, /^Faction: Red Cord is gone — Ferrybend wrecker crew wiped out/);
    assert.deepEqual(replay(initial, gone.runs), gone.state);
    const old = line(initial, ENDED, { carrier: { rules: ['consumableRecovery'] } });
    assert.equal(factionNamed(old.state, 'Red Cord').summary, OWNER);
    assert.equal(factionNamed(line(initial, '~ faction Red Cord — a destroyed wagon on their road', marked).state, 'Red Cord').summary, 'a destroyed wagon on their road');
    assert.equal(factionNamed(line(initial, '+ faction Salt Men — the gang wiped out', marked).state, 'Salt Men').name, 'Salt Men', 'only ~ lines');
    const unknown = line(initial, '~ faction Grey Men — disbanded', marked);
    assert.deepEqual([unknown.ok, unknown.code], [false, 'NOT_FOUND'], 'as - faction for an unknown name');
});

test('a clause about another faction does not end this one', () => {
    const initial = lines(makeState({ minutes: 1440 }), `${MADE}\n+ faction Grey Ledger — bond brokers`, marked).state;
    for (const text of ['buying up Red Cord\u2019s debts after the crew was wiped out', 'the Red Cord gang disbanded', 'Red Cord\u2019s crew wiped out']) {
        const run = line(initial, `~ faction Grey Ledger — ${text}`, marked);
        assert.ok(factionNamed(run.state, 'Grey Ledger'), text);
        assert.ok(factionNamed(run.state, 'Red Cord'), text);
    }
    assert.equal(factionNamed(line(initial, ENDED, marked).state, 'Red Cord'), undefined, 'the owner\u2019s line still ends it');
});

test('on the host: a new reply ends the faction, and Re-read and reload agree; a reply without the mark keeps it', async t => {
    const host = await createHost({ modules: [createModule()] });
    t.after(() => host.close());
    const factions = () => host.sdk.query('chronicle.factions').map(faction => faction.name);
    const reply = text => `x\n<Changes>\n${text}\n</Changes>`;
    await host.send('Hi.', reply(MADE));
    await host.send('Strike.', reply(ENDED));
    assert.deepEqual(factions(), []);
    const at = host.ctx.chat.length - 1;
    assert.ok(readRecord(host.ctx.chat[at]).rules.includes('factionGone'));
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(factions(), []);
    host.store.rebuild();
    assert.deepEqual(factions(), []);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.deepEqual(factions(), []);
    // The record as an older version left it: no mark.
    const record = host.ctx.chat[at].extra.storySuite;
    record.rules.splice(record.rules.indexOf('factionGone'), 1);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(factions(), ['Red Cord']);
});
