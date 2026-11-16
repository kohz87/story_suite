import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createNpcPart, validateNpcSlice } from '../src/npc-meters.js';
import { projectDossierState } from '../dossier-ui.js';
import { runtimeSource } from './helpers/runtime-source.js';
import { lastRelationshipChangeHtml, relationshipHistoryHtml } from '../dossier-ui-relationship.js';
import { storyMinuteText } from '../calendar.js';
import { eventSummary } from '../src/npc-meters-pacing.js';
import { LOOSE, SHUT, STORED, cardOf, eventOf, pacedSuite, suite } from './storysuite-v2-meters-ladder.helpers.js';

// ---- 7. the dossier's "Last relationship change" is the meters' own net change (hosted; read time only) ----

test('net change card: a story-line move without Delta\'s tier caps shows the net amounts and the reply (no source chip, no tier, no reason)', async () => {
    const s = await suite();
    const reply = await s.say(['~ npc Mira | trust: +5 | tension: +2']);
    const now = s.npc('Mira').meters;
    const { shown, html } = cardOf(s);
    assert.equal(shown.message, reply);
    assert.equal(shown.delta.trust, now.trust - 10);
    assert.equal(shown.delta.tension, now.tension);
    assert.ok(shown.delta.trust > 0 && shown.delta.tension > 0);
    assert.match(html, new RegExp(`Reply #${reply}`));
    assert.match(html, new RegExp(`Trust \\+${shown.delta.trust}`));
    assert.doesNotMatch(html, /Old sidecar|Ordinary|Meaningful|Asked|Held|From the s/);
});

test('net change card: a scanner-only move and a mixed reply show amounts and the reply, never a source chip', async () => {
    const s = await suite();
    const first = await s.say([]);
    await s.adapter.adjust({ name: 'Mira', meters: { trust: 3 }, start: { trust: 10, affection: 0, desire: 0, tension: 0 }, reply: first });
    let card = cardOf(s);
    assert.equal(card.shown.delta.trust, 3);
    assert.doesNotMatch(card.html, /From the s/);
    assert.match(card.html, new RegExp(`Reply #${first}`));
    const second = await s.say(['~ npc Mira | trust: +2']);
    await s.adapter.adjust({ name: 'Mira', meters: { affection: 2 }, reply: second });
    card = cardOf(s);
    assert.ok(card.shown.delta.trust > 0 && card.shown.delta.affection > 0, 'both axes moved on that reply');
    assert.match(card.html, /Trust \+/);
    assert.match(card.html, /Affection \+/);
    assert.doesNotMatch(card.html, /From the s/);
});

test('net change card: a latest window with no net built-in movement, or none at all, shows the stored card as today', async () => {
    const s = await suite({ settings: { customMeters: [{ name: 'Awe', min: 0, max: 50 }] } });
    assert.equal(cardOf(s).shown.reason, 'Old sidecar reason.', 'no window yet');
    await s.say(['~ npc Mira | awe: +4']);
    const card = cardOf(s);
    assert.equal(card.shown.reason, 'Old sidecar reason.', 'only a custom meter moved');
    assert.doesNotMatch(card.html, /From the s/);
    assert.match(card.html, /Old sidecar reason/);
});

test('net change card: a manual edit at or after the window keeps "Manual edit"', async () => {
    const s = await suite();
    const reply = await s.say(['~ npc Mira | trust: +5']);
    const npc = { ...structuredClone(s.delta.records.npc_mira), lastRelationshipChange: { impact: 'manual', delta: { trust: 4, affection: 0, desire: 0, tension: 0 }, reason: '', message: reply } };
    const shown = projectDossierState({ npcs: [npc], meterViews: s.adapter.dossierMeters([npc]) }, { chatKey: 'c1' }).npcs[0].lastRelationshipChange;
    assert.equal(shown.impact, 'manual');
    assert.match(lastRelationshipChangeHtml(shown), /Manual edit/);
});

test('net change card: the projection never reaches the scan view or stored dossier data; swipes and reloads recompute it; standalone is unchanged', async () => {
    const s = await suite();
    await s.say(['~ npc Mira | trust: +5']);
    const stored = JSON.stringify(s.delta.records);
    const { npc } = cardOf(s);
    assert.equal(JSON.stringify(s.delta.records), stored, 'the stored dossiers are untouched');
    assert.deepEqual(npc.lastRelationshipChange, STORED, 'the record the projection read keeps its own value');
    const scanView = s.adapter.sliceView(Object.values(s.delta.records));
    assert.ok(scanView.every(item => !item.lastRelationshipChange || JSON.stringify(item.lastRelationshipChange) === JSON.stringify(s.delta.records[item.id].lastRelationshipChange)), 'sliceView carries no projection');
    assert.doesNotMatch(JSON.stringify(s.host.head().domains), /relChange/, 'nothing of it is in Story Block\'s state');
    await s.swipe([]);
    assert.equal(cardOf(s).shown.reason, 'Old sidecar reason.', 'the swiped reply moved nothing: back to the stored card');
    await s.regenerate(['~ npc Mira | trust: +3']);
    assert.match(cardOf(s).html, /Trust \+3/);
    s.adapter.stop();
    assert.deepEqual(s.adapter.dossierMeters(Object.values(s.delta.records)), {});
    const alone = projectDossierState({ npcs: [{ ...structuredClone(s.delta.records.npc_mira), lastRelationshipChange: STORED }] }, { chatKey: 'c1' }).npcs[0].lastRelationshipChange;
    assert.equal(alone.reason, 'Old sidecar reason.');
    assert.equal(alone.hosted, undefined);
});

test('net change card: the open-panel token covers the host views, so a changed card refreshes the panel', async () => {
    const s = await suite();
    const before = JSON.stringify(s.adapter.dossierMeters(Object.values(s.delta.records)));
    await s.say(['~ npc Mira | trust: +5']);
    assert.notEqual(JSON.stringify(s.adapter.dossierMeters(Object.values(s.delta.records))), before);
    assert.match(runtimeSource(), /dossierHostViews\(state\)\]\);/, 'dossierViewToken ends with the host views');
});

test('net change card: the same reply\'s sidecar event is not listed again under "Earlier changes"; an older one still is', async () => {
    const s = await suite();
    const reply = await s.say(['~ npc Mira | trust: +5']);
    const same = { impact: 'meaningful', delta: { trust: 5, affection: 0, desire: 0, tension: 0 }, reason: 'Same reply event.', message: reply };
    const older = { impact: 'ordinary', delta: { trust: 1, affection: 0, desire: 0, tension: 0 }, reason: 'Older event.', message: reply - 1 };
    const npc = { ...structuredClone(s.delta.records.npc_mira), lastRelationshipChange: same, relationshipEventHistory: [older, same] };
    const shown = projectDossierState({ npcs: [npc], meterViews: s.adapter.dossierMeters([npc]) }, { chatKey: 'c1' }).npcs[0];
    assert.equal(shown.lastRelationshipChange.hosted, true);
    const html = relationshipHistoryHtml(shown.recentRelationshipChanges, shown.lastRelationshipChange);
    assert.doesNotMatch(html, /Same reply event/);
    assert.match(html, /Older event/);
});

test('relationship card: a Tension amount colours by meaning like the arrows (up bad, down good); the other axes by sign', () => {
    const html = lastRelationshipChangeHtml({ impact: 'ordinary', reason: 'x', message: 1, delta: { trust: 2, affection: 0, desire: -1, tension: 3 } });
    assert.match(html, /delta-rel-delta-down delta-rel-tension">Tension \+3/);
    assert.match(html, /delta-rel-delta-up delta-rel-trust">Trust \+2/);
    assert.match(html, /delta-rel-delta-down delta-rel-desire">Desire -1/);
    assert.match(lastRelationshipChangeHtml({ impact: 'ordinary', reason: 'x', message: 1, delta: { trust: 0, affection: 0, desire: 0, tension: -4 } }), /delta-rel-delta-up delta-rel-tension">Tension -4/);
});

test('hosted forward: an open dossier panel draws again when each delayed npc.adjust settles', async () => {
    const calls = [];
    let release = null;
    const refreshes = [];
    let cleanup = null;
    const prior = globalThis.document;
    globalThis.document = { documentElement: { dataset: { npcStateDeltaStoryBlockV2: '1' } }, getElementById: id => (id === 'npc_state_delta_dossier_root' ? { __npcStateDeltaStage1Ui: { scheduleRefresh: () => refreshes.push(calls.length) } } : null) };
    try {
        const rt = { storySuiteV2: { hosted: () => true, adjust: change => { calls.push(change.name); return new Promise(resolve => { release = resolve; }); } } };
        // runtime-hosted.js with its siblings copied beside it; only the SillyTavern-bound helper and settings files are stubs.
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-hosted-forward-'));
        const root = fileURLToPath(new URL('..', import.meta.url));
        fs.cpSync(root, temp, { recursive: true, filter: from => !/[\\/](tests|docs|scripts|\.git|node_modules|dist)([\\/]|$)/.test(path.relative(root, from)) });
        fs.writeFileSync(path.join(temp, 'runtime-scan-helpers.js'), [
            "import { normalizeName, normalizeRelationshipBaseline, npcMatchesLabel } from './core.js'; import { rejectedOverallLook } from './appearance-update.js'; import { physicalTraitSwaps } from './appearance-physical.js'; import { moodNumbers } from './npc-mood.js';",
            'export const chatContext = () => ({ chat: [] }); export const markStands = () => true; export const replayScope = () => null; export const scopedAdapter = a => a; ' + fs.readFileSync(path.join(root, 'runtime-scan-helpers-parts', 'value-rules.js'), 'utf8').split('\n').find(line => line.startsWith('export const worth')),
            fs.readFileSync(path.join(root, 'runtime-scan-helpers-parts', 'scan-results.js'), 'utf8').split('// What a committed scan tells the slice')[1],   // the real pure readers moved out of runtime-hosted.js
        ].map((part, index) => (index === 2 ? '//' + part : part)).join('\n'));
        fs.writeFileSync(path.join(temp, 'runtime-settings.js'), 'export const getSettings = () => ({}); export const setRpgProbe = () => {};');
        cleanup = temp;
        const { createHostedPart } = await import(pathToFileURL(path.join(temp, 'runtime-hosted.js')).href);
        const part = createHostedPart(rt, { chatHydrationStatus: () => 'ready', getChatKey: () => 'c1', getChatState: () => ({ npcs: [] }), latestMessageId: () => 1, latestReplyIndex: () => 1 });
        const npc = (id, trust) => ({ id, name: id, relationship: { trust, affection: 0, desire: 0, tension: 0 } });
        part.forwardRelationshipChangesToHost([npc('a', 0), npc('b', 0)], [npc('a', 2), npc('b', 3)], 1);
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls, ['a'], 'sequential: the first is pending');
        assert.deepEqual(refreshes, [], 'nothing drawn before the host settles');
        release(); await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(refreshes, [1]);
        release(); await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls, ['a', 'b']);
        assert.deepEqual(refreshes, [1, 2]);
    } finally {
        globalThis.document = prior;
        if (cleanup) fs.rmSync(cleanup, { recursive: true, force: true });
    }
});

// ---- 8. the card's event details: the tier, "Held" and "Asked", and the story date (the reply's own record, written whole) ----

test('event card: a story line that moved shows the tier chip, the amounts and the story date in the stamp', async () => {
    const s = await pacedSuite(LOOSE);
    const reply = await s.say(['~ npc Mira | trust: +1 | affection: +1 | tension: +1']);
    const { shown, html } = cardOf(s);
    const date = storyMinuteText(12 * 1440);
    assert.ok(date, 'the clock gives a date');
    assert.match(html, /delta-rel-impact-ordinary">Ordinary</);
    assert.match(html, new RegExp(`Reply #${reply} · ${date}`));
    assert.match(html, /Trust \+1/);
    assert.doesNotMatch(html, /Held|Asked|Old sidecar/);
    assert.equal(shown.event.held, false);
});

test('event card: the highest tier actually spent is shown (a meaningful line cut to ordinary by the day shows Ordinary)', async () => {
    const s = await pacedSuite({ ordinary: 9, meaningful: 0, major: 0, extreme: 0 });
    await s.say(['~ npc Mira | trust: +9 | impact: major']);
    assert.match(cardOf(s).html, /delta-rel-impact-ordinary">Ordinary</);
    assert.deepEqual(eventOf(s).events.map(item => [item.tier, item.held]), [['ordinary', false]]);
});

test('event card: a line the day held shows "Held: …. Nothing moved." and what was asked; the meters do not move', async () => {
    const s = await pacedSuite({ ordinary: 1, meaningful: 0, major: 0, extreme: 0 });
    await s.say(['~ npc Mira | trust: +1']);
    const before = JSON.stringify(s.npc('Mira').meters);
    const reply = await s.say(['~ npc Mira | trust: +1 | affection: +1']);
    assert.equal(JSON.stringify(s.npc('Mira').meters), before, 'nothing moved');
    const { html } = cardOf(s);
    assert.match(html, /delta-rel-impact-ordinary">Ordinary</);
    assert.match(html, new RegExp(`Reply #${reply} · ${storyMinuteText(12 * 1440)}`));
    assert.match(html, /Held: today&#039;s ordinary is used on [^.]*\. Nothing moved\./);
    assert.match(html, /Asked: Trust \+1, Affection \+1/);
    assert.doesNotMatch(html, /Progress only|Old sidecar/);
});

test('event card: two held story lines on one reply sum their asks per axis', async () => {
    const s = await pacedSuite(SHUT);
    await s.say(['~ npc Mira | trust: +1', '~ npc Mira | trust: +1 | desire: +2']);
    assert.equal(eventOf(s).events.length, 2);
    assert.match(cardOf(s).html, /Asked: Trust \+2, Desire \+2/);
});

test('event card: a scanner request for a story-named axis is not counted twice; its other axes are', async () => {
    const s = await pacedSuite(SHUT);
    const reply = await s.say(['~ npc Mira | trust: +1']);
    await s.adapter.adjust({ name: 'Mira', meters: { trust: 1, affection: 1 }, reply, impact: 'ordinary' });
    assert.deepEqual(eventOf(s).events.map(item => item.src), ['story', 'scan']);
    assert.match(cardOf(s).html, /Asked: Trust \+1, Affection \+1/);
    // A story line that moved leaves its axis to itself: the scan's request for it makes no event at all.
    const loose = await pacedSuite(LOOSE);
    const next = await loose.say(['~ npc Mira | trust: +1']);
    await loose.adapter.adjust({ name: 'Mira', meters: { trust: 1 }, reply: next, impact: 'ordinary' });
    assert.deepEqual(eventOf(loose).events.map(item => item.src), ['story']);
});

test('event card: a later reply replaces the record whole; a reply whose window moved on shows the plain card', async () => {
    const s = await pacedSuite(LOOSE);
    const first = await s.say(['~ npc Mira | trust: +1']);
    const second = await s.say(['~ npc Mira | affection: +1']);
    assert.equal(eventOf(s).at, s.host.store.carrierSid(second), 'only the newest reply is kept');
    assert.notEqual(first, second);
    const entry = s.npc('Mira');
    assert.equal(entry.event.events.length, 1);
    await s.say([]);   // a reply with no line for Mira: the window and the event stay the second reply's
    assert.match(cardOf(s).html, new RegExp(`Reply #${second}`));
});

test('event card: replay equals live, and the meters match a chat that never had the deleted reply (middle delete, rebuild)', async () => {
    const lines = [['~ npc Mira | trust: +3'], ['~ npc Mira | affection: +2'], ['~ npc Mira | trust: +1 | tension: +1']];
    const a = await pacedSuite(LOOSE);
    await a.say(['~ npc Mira | trust: +1']);
    for (const set of lines) await a.say(set);
    const gone = a.host.store.headIndex() - 2;   // the second of the three
    await a.host.st.deleteMessage(gone);
    await a.host.st.deleteMessage(gone - 1);
    assert.deepEqual(a.host.store.problems(), [], 'nothing was skipped');
    const b = await pacedSuite(LOOSE);
    await b.say(['~ npc Mira | trust: +1']);
    for (const set of [lines[0], lines[2]]) await b.say(set);
    assert.equal(JSON.stringify(a.npc('Mira').meters), JSON.stringify(b.npc('Mira').meters), 'the meters are the same');
    assert.deepEqual(validateNpcSlice(a.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    // The event is the surviving reply's own whole record (the net amounts and the stamp's number are the window's, as on main).
    assert.deepEqual(eventOf(a).events, eventOf(b).events, 'the surviving reply\'s event');
    assert.equal(eventOf(a).date, eventOf(b).date);
    // #295: the window's reply number is past the head now (the earlier message left), so the card is not drawn from it: the stored card
    // shows, not a net change under the wrong "Reply #N" or the old window's amounts.
    assert.ok(a.host.store.headIndex() < a.npc('Mira').reply, 'the window names a reply that is gone');
    assert.match(cardOf(a).html, /Old sidecar reason/);
    assert.doesNotMatch(cardOf(a).html, /January 13|Reply #(?!1<)/);
    assert.match(cardOf(b).html, /delta-rel-impact-ordinary">Ordinary<.*January 13/s, 'a chat that never had the reply keeps its card');
    const head = JSON.stringify(a.host.head());
    a.host.store.rebuild();
    assert.equal(JSON.stringify(a.host.head()), head, 'replay equals the live state');
});

test('event card: a swipe falls back to the earlier reply\'s card; a regenerate and a delete follow their own reply', async () => {
    const s = await pacedSuite(LOOSE);
    await s.say(['~ npc Mira | trust: +1']);
    const first = s.host.store.headIndex();
    await s.say(['~ npc Mira | affection: +1']);
    await s.swipe([]);
    const swiped = cardOf(s);
    assert.match(swiped.html, new RegExp(`Reply #${first}`), 'the swiped reply made no event: the earlier reply\'s card');
    assert.doesNotMatch(swiped.html, /Affection/);
    await s.regenerate(['~ npc Mira | trust: +2']);
    assert.match(cardOf(s).html, /delta-rel-impact-ordinary">Ordinary</);
    assert.match(cardOf(s).html, /Trust \+1/, 'asked +2, the ordinary tier moved +1');
    await s.host.st.deleteMessage(s.host.store.headIndex());
    await s.host.st.deleteMessage(s.host.store.headIndex());
    assert.deepEqual(s.host.store.problems(), []);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
});

test('event card: an older record without a last event (or an unusable one) shows exactly the net card', async () => {
    const s = await pacedSuite(LOOSE);
    await s.say(['~ npc Mira | trust: +2']);
    const withEvent = cardOf(s).html;
    const part = createNpcPart({});
    const slice = structuredClone(s.host.head().domains.people?.bonds);
    delete slice.npcs.npc_mira.lastEvent;
    assert.deepEqual(validateNpcSlice(slice), [], 'an old record is valid');
    for (const bad of ['{', '{"at":1,"date":"","events":[]}', JSON.stringify({ at: 1, date: 'x'.repeat(41), events: [{ src: 'story', ask: { trust: 1 }, tier: 'ordinary', held: true, note: '' }] }),
        JSON.stringify({ at: 1, date: '', events: [{ src: 'story', ask: { luck: 1 }, tier: 'ordinary', held: true, note: '' }] }),
        JSON.stringify({ at: 1, date: '', events: [{ src: 'story', ask: { trust: 1.5 }, tier: 'ordinary', held: true, note: '' }] }),
        JSON.stringify({ at: 1, date: '', events: [{ src: 'story', ask: { trust: 1 }, tier: 'huge', held: true, note: '' }] }),
        JSON.stringify({ at: 1, date: '', events: Array.from({ length: 5 }, () => ({ src: 'scan', ask: {}, tier: 'ordinary', held: false, note: '' })) }), 7]) {
        const copy = structuredClone(slice);
        copy.npcs.npc_mira.lastEvent = bad;
        assert.equal(validateNpcSlice(copy).length, 1, `unusable: ${String(bad).slice(0, 50)}`);
    }
    assert.ok(part && withEvent.includes('Ordinary'));
});

test('event card: a hosted manual edit keeps "Manual edit" with the edited amounts (the save writes the manual change; the slice window restarts)', async () => {
    assert.match(fs.readFileSync(fileURLToPath(new URL('../runtime-editor-save.js', import.meta.url)), 'utf8'), /else if \(meterEdits && shownRelationship\) \{[^}]*impact: 'manual',\s*delta: edited/s);
    const s = await pacedSuite(LOOSE);
    const reply = await s.say(['~ npc Mira | trust: +1']);
    await s.adapter.setMeters({ name: 'Mira', meters: { trust: 30 } });
    const npc = { ...structuredClone(s.delta.records.npc_mira), lastRelationshipChange: { impact: 'manual', delta: { trust: 19, affection: 0, desire: 0, tension: 0 }, reason: '', message: reply } };
    const shown = projectDossierState({ npcs: [npc], meterViews: s.adapter.dossierMeters([npc]) }, { chatKey: 'c1' }).npcs[0].lastRelationshipChange;
    const html = lastRelationshipChangeHtml(shown);
    assert.match(html, /Manual edit/);
    assert.match(html, /Trust \+19/);
});

test('event card: same-reply history is filtered before the display limit (older rows are not pushed out)', async () => {
    const s = await pacedSuite(LOOSE);
    const reply = await s.say(['~ npc Mira | trust: +1']);
    const mk = (n, message) => ({ impact: 'ordinary', delta: { trust: 1, affection: 0, desire: 0, tension: 0 }, reason: `Event ${n}.`, message });
    const history = [mk(1, reply - 3), mk(2, reply - 2), mk(3, reply - 1), mk(4, reply), mk(5, reply)];
    const npc = { ...structuredClone(s.delta.records.npc_mira), lastRelationshipChange: history.at(-1), relationshipEventHistory: history };
    const shown = projectDossierState({ npcs: [npc], meterViews: s.adapter.dossierMeters([npc]) }, { chatKey: 'c1' }).npcs[0];
    const html = relationshipHistoryHtml(shown.recentRelationshipChanges, shown.lastRelationshipChange);
    assert.doesNotMatch(html, /Event 4|Event 5/);
    for (const n of [1, 2, 3]) assert.match(html, new RegExp(`Event ${n}\\.`));
});

test('event card: a host capture or Re-read that settles after Delta\'s render asks an open panel to draw again', async () => {
    const draws = [];
    const doc = { documentElement: { dataset: {} }, getElementById: id => (id === 'npc_state_delta_dossier_root' ? { __npcStateDeltaStage1Ui: { scheduleRefresh: () => draws.push(1) } } : null), addEventListener() {}, dispatchEvent() { return true; } };
    const s = await suite({ doc });
    const before = draws.length;
    await s.say(['~ npc Mira | trust: +2']);
    assert.ok(draws.length > before, 'the host\'s turn event asked the panel to refresh');
});

test('event card: a held line that names only custom meters has no Asked, so it does not replace the older card', async () => {
    const s = await pacedSuite(SHUT, { settings: { customMeters: [{ name: 'Awe', min: 0, max: 50 }] } });
    await s.say(['~ npc Mira | awe: +3 | impact: major']);
    const { shown, html } = cardOf(s);
    assert.equal(shown.event, undefined);
    assert.doesNotMatch(html, /Held:/);
    assert.match(html, /Old sidecar/);
});

test('event summary: events naming only custom meters do not count toward the tier chip; the colour of Held comes from the theme', () => {
    const item = (tier, ask, held = false) => ({ src: 'scan', ask, tier, held, note: '' });
    const tier = events => eventSummary({ at: 1, date: '', events }).tier;
    assert.equal(tier([item('major', {}), item('ordinary', { trust: 1 })]), 'ordinary');
    assert.equal(tier([item('major', {}), item('meaningful', { trust: 1 }, true)]), 'meaningful', 'all that ask were held: the asked tier');
    assert.equal(tier([item('major', {})]), 'major', 'nothing asks anything: as before');
    assert.match(fs.readFileSync(new URL('../dossier-ui-styles.js', import.meta.url), 'utf8'), /\.delta-rel-held \{ color:var\(--ss-warn-text, var\(--ss-warn, #e8c46a\)\)/);
});
