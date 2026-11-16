import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateNpcSlice } from '../../modules/people/meters/npc-meters.js';
import { withSectionHtml } from '../../modules/people/legacy/dossier-ui-sections.js';
import { projectDossierState } from '../../modules/people/legacy/dossier-ui.js';
import { NO_REASON, recentChangeRowHtml } from '../../modules/people/legacy/dossier-ui-relationship.js';
import { cutWords, eventLog, movesOf, nextEvent, readEvent, withEvidence } from '../../modules/people/meters/npc-meters-pacing.js';
import { logKept, reasonKept } from '../../modules/people/meters/npc-meters-slice.js';
import { LOOSE, OWNER_LINES, OWNER_ROWS, SIEKE_TENSION, SIEKE_TRUST, TEMIWA_TRUST, eventOf, hostedForwardParts, ownerForward, ownerRecords, pacedSuite, rowOf } from './storysuite-v2-meters-ladder.helpers.js';

// ---- 9. a reply with both a '~ npc' line and a one-pass relationshipDelta for the same person (owner's run, 12 Nov: main-reply-1755) ----

let forwardParts = null;

test('one-pass + line, same reply: the meters move once (the line\'s), and Recent changes carries the one-pass evidence of the meters the line moved', async () => {
    const s = await pacedSuite(LOOSE, { records: ownerRecords() });
    const reply = await s.say(OWNER_LINES);
    const moved = { sieke: structuredClone(s.npc('Sieke').meters), temiwa: structuredClone(s.npc('Sister Temiwa').meters) };
    assert.deepEqual([moved.sieke.trust, moved.sieke.tension, moved.temiwa.trust], [1, 1, 1], 'ordinary: each meter at most 1 (tension held at 1, +2 asked)');
    assert.equal(rowOf(s, 'npc_sieke').html.includes(NO_REASON), true, 'before the scan: no reason (the owner\'s Recent changes row)');
    const sent = await ownerForward(s, reply);
    assert.deepEqual(sent.map(item => [item.name, item.meters, Object.keys(item.why)]), [['Sieke', {}, ['trust', 'tension']], ['Sister Temiwa', {}, ['trust']]]);
    for (const change of sent) assert.notEqual((await s.adapter.adjust(change))?.ok, false);
    assert.deepEqual([s.npc('Sieke').meters, s.npc('Sister Temiwa').meters], [moved.sieke, moved.temiwa], 'the evidence moves nothing');
    const sieke = rowOf(s, 'npc_sieke');
    assert.equal(sieke.shown.reason, `${SIEKE_TRUST.replace(/\.$/, '')}; ${SIEKE_TENSION.replace(/\.$/, '')}`);
    assert.match(sieke.html, /Trust \+1/);
    assert.match(sieke.html, /Tension \+1/);
    assert.match(sieke.html, /Astra paid the fifty copper/);
    assert.doesNotMatch(sieke.html, new RegExp(NO_REASON));
    assert.equal(rowOf(s, 'npc_sister-temiwa').shown.reason, TEMIWA_TRUST.replace(/\.$/, ''));
    // A one-pass delta the sidecar did accept (it gave a reason) is still the line's: one move, not two.
    await s.adapter.adjust({ name: 'Sieke', meters: { trust: 1, tension: 2 }, start: { trust: 0, affection: 0, desire: 0, tension: 0 }, reply, impact: 'ordinary', why: { trust: 'other words' } });
    assert.deepEqual(s.npc('Sieke').meters, moved.sieke, 'the meters the line named move once per reply');
    assert.equal(rowOf(s, 'npc_sieke').shown.reason.startsWith('Astra paid'), true, 'a reason once given is kept');
    const live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'replay is the live state');
});

test('one-pass reason: the line\'s own why wins; without a line, a zero axis, or a plain scan, nothing is written (never invented)', async () => {
    const s = await pacedSuite(LOOSE, { records: ownerRecords() });
    const reply = await s.say(['~ npc Sieke | tension: +2 | trust: +1 | impact: ordinary | why: the button snapped']);
    for (const change of await ownerForward(s, reply)) await s.adapter.adjust(change);
    assert.equal(rowOf(s, 'npc_sieke').shown.reason, 'the button snapped', 'the line\'s own reason stands');
    // Temiwa had no line on this reply: her evidence is refused, nothing of her is written.
    assert.equal(s.host.head().domains.people.bonds.npcs['npc_sister-temiwa'], undefined);
    const quiet = await s.say([]);
    const before = JSON.stringify(s.host.head().domains.people?.bonds);
    const out = await s.adapter.adjust({ name: 'Sieke', meters: {}, reply: quiet, why: { trust: SIEKE_TRUST } });
    assert.equal(out?.code, 'REFUSED');
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), before, 'no line on the reply: no reason, no change');
    // Evidence only for an axis the row did not move, and a scan that is not a one-pass block, carry none.
    const zero = [{ id: 'npc_sieke', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 }, relationshipEvidence: { trust: 'words', affection: '', desire: '', tension: '' } }];
    assert.deepEqual(await ownerForward(s, quiet, zero), []);
    assert.deepEqual(await ownerForward(s, quiet, null), []);
    // An old reply (a line without why, no evidence sent) replays as it was: no reason appears.
    const old = await pacedSuite(LOOSE, { records: ownerRecords() });
    await old.say(OWNER_LINES);
    const stored = JSON.stringify(old.host.head().domains.people?.bonds);
    old.host.store.rebuild();
    assert.equal(JSON.stringify(old.host.head().domains.people?.bonds), stored);
    assert.equal(rowOf(old, 'npc_sieke').html.includes(NO_REASON), true);
});

test('withEvidence: only story events of the reply without a why, the axes each asked, cut at a word', () => {
    const text = JSON.stringify({ at: 'r1', date: '', events: [{ src: 'story', ask: { trust: 1 }, tier: 'ordinary', held: false, note: '' }, { src: 'scan', ask: { tension: 1 }, tier: 'ordinary', held: false, note: '' }, { src: 'story', ask: { tension: 2 }, tier: 'ordinary', held: false, note: '', why: 'own' }] });
    const out = JSON.parse(withEvidence(text, 'r1', { trust: 'kept the bargain.', tension: 'x' }));
    assert.deepEqual(out.events.map(item => item.why), ['kept the bargain', undefined, 'own']);
    assert.equal(withEvidence(text, 'r2', { trust: 'x' }), null, 'another reply');
    assert.equal(withEvidence(text, 'r1', { affection: 'x' }), null, 'no asked axis has evidence');
    const long = JSON.parse(withEvidence(text, 'r1', { trust: 'word '.repeat(80) })).events[0].why;
    assert.ok(long.length <= 240 && long.endsWith('…') && !/\s…$/.test(long));
});

test('hosted forward: a one-pass scan sends its evidence with npc.adjust (also with no move); any other scan sends none', async () => {
    forwardParts ??= await hostedForwardParts();
    const records = Object.values(ownerRecords());
    const onePass = await forwardParts.forward(records, records, 4, OWNER_ROWS, true);
    assert.deepEqual(onePass, [
        { name: 'Sieke', meters: {}, start: { trust: 0, affection: 0, desire: 0, tension: 0 }, reply: 4, why: { trust: SIEKE_TRUST, tension: SIEKE_TENSION } },
        { name: 'Sister Temiwa', meters: {}, start: { trust: 0, affection: 0, desire: 0, tension: 0 }, reply: 4, why: { trust: TEMIWA_TRUST } },
    ]);
    assert.deepEqual(await forwardParts.forward(records, records, 4, OWNER_ROWS, false), [], 'a scanner scan: nothing new is sent');
    const moved = records.map(npc => (npc.id === 'npc_sieke' ? { ...npc, relationship: { ...npc.relationship, trust: 1 } } : npc));
    assert.deepEqual((await forwardParts.forward(records, moved, 4, OWNER_ROWS, false)).map(item => [item.name, item.meters, item.why]), [['Sieke', { trust: 1 }, undefined]], 'as before');
});

// ---- 10. the reason's length: 240 characters for both sources, cut at a word with an ellipsis (owner, 12 Nov: "Recent changes got cut off") ----

test('reason length: cutWords keeps up to 240 whole, else cuts at a word with an ellipsis', () => {
    const fits = 'a'.repeat(240);
    assert.equal(cutWords(fits), fits);
    const long = `${'word '.repeat(60)}end`;
    const cut = cutWords(long);
    assert.ok(cut.length <= 240 && cut.endsWith('…') && !/\s…$/.test(cut) && long.startsWith(cut.slice(0, -1)));
    assert.ok(cutWords('😀 '.repeat(200)).length <= 240, 'counted in UTF-16 units, as the stored event is checked');
});

test('reason length: a line\'s own why is kept to 240 (whole when shorter, cut at a word when longer); the evidence is cut the same way', async () => {
    const two = `${'The courier slid the sealed letter under the door and left without a word. '.repeat(3)}`.trim();   // 230 characters
    assert.ok(two.length > 80 && two.length <= 240);
    const s = await pacedSuite(LOOSE, { records: ownerRecords() });
    await s.say([`~ npc Sieke | tension: +1 | impact: ordinary | why: ${two}`]);
    const whole = rowOf(s, 'npc_sieke');
    assert.equal(whole.shown.reason, two, 'a reason under 240 is shown whole (it was cut to 80)');
    assert.ok(whole.html.includes(two));
    const longer = `${two} ${two}`;
    await s.say([`~ npc Sieke | trust: +1 | impact: ordinary | why: ${longer}`]);
    const cut = rowOf(s, 'npc_sieke').shown.reason;
    assert.ok(cut.length <= 240 && cut.endsWith('…') && longer.startsWith(cut.slice(0, -1)) && !/\s…$/.test(cut), 'a longer one is cut at a word with an ellipsis');
    assert.ok(rowOf(s, 'npc_sieke').html.includes(cut.replace(/&/g, '&amp;')), 'the row carries all of it (no truncation in the markup)');
    // The one-pass evidence goes through the same cut.
    const e = await pacedSuite(LOOSE, { records: ownerRecords() });
    const reply = await e.say(['~ npc Sieke | tension: +1 | impact: ordinary']);
    await e.adapter.adjust({ name: 'Sieke', meters: {}, reply, why: { tension: longer } });
    assert.equal(rowOf(e, 'npc_sieke').shown.reason, cut);
    const live = JSON.stringify(e.host.head().domains.people?.bonds);
    e.host.store.rebuild();
    assert.equal(JSON.stringify(e.host.head().domains.people?.bonds), live, 'replay is the live state');
});

test('reason length (rule mark): a Re-read of a reply whose earlier read stored its reason cut to 80 keeps writing 80; a first read and a wide standing write 240', () => {
    const text = 'x '.repeat(100).trim();
    const standing = why => ({ domains: { npc: { npcs: { sieke: { lastEvent: JSON.stringify({ at: 'r1', date: '', events: [{ src: 'story', ask: { trust: 1 }, tier: 'ordinary', held: false, note: '', why }] }) } } } } });
    assert.equal(reasonKept({}, 'sieke', text), cutWords(text), 'live: 240');
    assert.equal(reasonKept({ standing: standing('x '.repeat(40).trim()) }, 'sieke', text), text.slice(0, 80).trim(), 'earlier read cut to 80: same again');
    assert.equal(reasonKept({ standing: standing(cutWords(text)) }, 'sieke', text), cutWords(text), 'earlier read already wide');
    assert.equal(reasonKept({ standing: { domains: { npc: { npcs: { sieke: { lastEvent: '{"events":[]}' } } } } } }, 'sieke', text), '', 'earlier read kept none: none (as before)');
    assert.deepEqual(reasonKept({}, 'sieke', { trust: 'words' }), { trust: 'words' }, 'the evidence map passes untouched');
});

test('reason length: the dossier row wraps the whole reason (no CSS truncation on the Recent changes rows or the With card)', () => {
    const root = fileURLToPath(new URL('../../modules/people/legacy', import.meta.url));
    const css = fs.readFileSync(path.join(root, 'dossier-ui-styles-sections.js'), 'utf8');
    for (const name of ['.delta-chg-via', '.delta-chg > div', '.delta-chg']) {
        const rule = css.split('\n').find(line => line.includes(`${name} {`)) || '';
        assert.ok(rule && !/text-overflow|line-clamp|white-space:\s*nowrap|max-height/.test(rule), `${name}: no truncation`);
    }
    assert.match(css.split('\n').find(line => line.includes('.delta-chg > div {')), /min-width:0/);
    assert.match(css.split('\n').find(line => line.includes('.delta-chg > div {')), /overflow-wrap:anywhere/);
    const view = fs.readFileSync(path.join(root, 'dossier-ui-view-model.js'), 'utf8');
    assert.doesNotMatch(view, /reason: plain\(source\.reason\)\.slice/, 'the With card reason is not sliced');
});

// (card traits win) What the scan reports as refused: a swapped card trait it kept (with the swaps, worded by lookDrift) and a role
// rewrite it kept (a Problem line, no cue), from the profile updates and the npcs rows; an accepted role or a first role is not reported.
test('refusedLooks: a kept card trait and a refused role rewrite are reported once per person; accepted ones are not', async () => {
    forwardParts ??= await hostedForwardParts();
    const was = { id: 'npc_sister-temiwa', name: 'Sister Temiwa', role: 'Church novice', overallAppearance: 'Long black hair. Brown eyes ringed dark.' };
    const now = { ...was, overallAppearance: 'Long black hair. Brown eyes ringed dark. A grey wool mantle.' };
    const row = { id: was.id, role: 'Exiled Saintess Candidate and Lay Sealer', overallAppearance: 'Long black hair. Pale eyes ringed dark. A grey wool mantle.' };
    const refused = forwardParts.refusedLooks(new Map([[was.id, was]]), [now], [row], [{ id: was.id, role: row.role }]);
    assert.deepEqual(refused, [
        { id: was.id, name: 'Sister Temiwa', before: was.overallAppearance, incoming: row.overallAppearance, swaps: [{ trait: 'eyes', said: 'pale', kept: 'brown' }] },
        { id: was.id, name: 'Sister Temiwa', text: 'Role change refused: the story called Sister Temiwa "Exiled Saintess Candidate and Lay Sealer"; the record keeps "Church novice".' },
    ]);
    assert.deepEqual(forwardParts.refusedLooks(new Map([[was.id, was]]), [{ ...now, role: 'Lay Sealer' }], [], [{ id: was.id, role: 'Lay Sealer' }]), [], 'an accepted role');
    assert.deepEqual(forwardParts.refusedLooks(new Map([[was.id, { ...was, role: '' }]]), [{ ...was, role: '' }], [], [{ id: was.id, role: 'Lay Sealer' }]), [], 'no role held');
    assert.deepEqual(forwardParts.refusedLooks(new Map([[was.id, { ...was, manualProfileFields: ['role'] }]]), [was], [], [{ id: was.id, role: 'Lay Sealer' }]), [], 'a locked role is the reader\'s');
});

// (card traits win, round 2) A refusal is reported from either row channel, from the flat appearance, a named form and the overall look,
// and a row without an id is matched by name or alias the way the merge matches it.
test('refusedLooks: flat and named-form swaps, a name-only row and an ordinary npcs row are reported once', async () => {
    forwardParts ??= await hostedForwardParts();
    const was = { id: 'npc_sister-temiwa', name: 'Sister Temiwa', aliases: ['Temiwa'], role: 'Church novice', overallAppearance: '', appearance: 'Brown eyes, a grey habit',
        appearanceForms: [{ name: 'Rite', appearance: 'Black hair, a white stole' }] };
    const prior = new Map([[was.id, was]]);
    const flat = forwardParts.refusedLooks(prior, [was], [], [{ name: 'Temiwa', appearance: 'Pale eyes, a grey habit' }]);
    assert.deepEqual(flat.map(item => [item.id, item.swaps]), [[was.id, [{ trait: 'eyes', said: 'pale', kept: 'brown' }]]], 'name-only ordinary npcs row, flat appearance');
    const formed = forwardParts.refusedLooks(prior, [was], [{ name: 'Sister Temiwa', appearanceForms: [{ name: 'Rite', appearance: 'Red hair, a white stole' }] }], []);
    assert.deepEqual(formed.map(item => [item.id, item.swaps?.[0]?.trait]), [[was.id, 'hair']], 'profile row by name, named form');
    const twice = forwardParts.refusedLooks(prior, [was], [{ id: was.id, appearance: 'Pale eyes, a grey habit' }], [{ id: was.id, appearance: 'Pale eyes, a grey habit' }]);
    assert.equal(twice.length, 1, 'the same person in both channels is reported once');
    assert.deepEqual(forwardParts.refusedLooks(prior, [{ ...was, appearance: 'Pale eyes, a grey habit' }], [], [{ id: was.id, appearance: 'Pale eyes, a grey habit' }]), [], 'an accepted look is not reported');
    const role = forwardParts.refusedLooks(prior, [was], [], [{ name: 'Temiwa', role: 'Prioress' }]);
    assert.equal(role.length, 1, 'a role rewrite sent by name only is reported');
});

// ---- 10. Recent changes keeps the meters' last three changes (the reply's event, and the two replies before it) ----

test('last three changes: each reply keeps its event; the list shows the newest three with amounts, date, reply and reason; older ones drop off', async () => {
    const s = await pacedSuite(LOOSE);
    const replies = [];
    for (const line of ['~ npc Mira | trust: +2 | why: she was thanked', '~ npc Mira | affection: +1 | tension: +1 | why: a sharp word', '~ npc Mira | desire: +1 | why: a long look', '~ npc Mira | trust: -1 | why: a broken promise']) replies.push(await s.say([line]));
    const recent = s.npc('Mira').recent;
    assert.equal(recent.length, 3, 'the current reply and two before it');
    assert.deepEqual(recent.map(row => row.mv), [{ trust: -1 }, { desire: 1 }, { affection: 1, tension: 1 }], 'newest first; the first reply dropped off');
    assert.deepEqual(recent.map(row => row.why), ['a broken promise', 'a long look', 'a sharp word']);
    assert.deepEqual(recent.map(row => row.n), [replies[3], replies[2], replies[1]]);
    assert.ok(recent.every(row => row.date && !row.held));
    assert.equal(eventOf(s).prev.length, 2, 'the stored text keeps two earlier rows');
    // The dossier lists them (the latest from the net card, the earlier two from the log), each with its date, reply and reason.
    const state = projectDossierState({ npcs: [{ id: 'npc_mira', name: 'Mira' }], reply: replies[3], meterViews: { npc_mira: { recent, bars: [] } } });
    const html = withSectionHtml(state.npcs[0]);
    assert.equal((html.match(/class="delta-chg"/g) || []).length, 3);
    assert.match(html, /a broken promise/); assert.match(html, /a long look/); assert.match(html, /a sharp word/);
    assert.doesNotMatch(html, /she was thanked/, 'a fourth change is not listed');
    assert.match(html, /Tension \+1/); assert.match(html, /Desire \+1/); assert.match(html, /Trust −1/);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    const head = JSON.stringify(s.host.head());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head()), head, 'replay equals live');
});

test('last three changes: two events of one reply make one row (the amounts moved, the reasons joined); a held reply says Held', async () => {
    const s = await pacedSuite({ ordinary: 1, meaningful: 99, major: 99, extreme: 99 });
    await s.say(['~ npc Mira | trust: +1 | why: first', '~ npc Mira | affection: +1 | why: second']);
    await s.say(['~ npc Mira | trust: +1 | why: third']);
    await s.say(['~ npc Mira | trust: +1 | why: fourth']);
    const rows = s.npc('Mira').recent;
    assert.ok(rows.length === 3 && rows[0].held && rows[1].held, 'the later same-day lines were held: nothing moved');
    assert.match(rows[0].note, /./);
    assert.match(recentChangeRowHtml({ entry: rows[0] }), /Held/);
    assert.match(rows[2].why, /first; second/, 'one row for the reply: the reasons joined');
    assert.deepEqual(rows[2].mv, { trust: 1 }, 'the second line of the day was held: only the first moved');
});

test('last three changes (rule mark): an older text without the log is written as it was, and starts a log only at its next reply; nothing is made up', () => {
    const old = JSON.stringify({ at: 5, date: 'May 1', events: [{ src: 'story', ask: { trust: 2 }, tier: 'ordinary', held: false, note: '', why: 'an old reason' }] });
    const base = { src: 'story', ask: { trust: 1 }, tier: 'ordinary', held: false, note: '', mv: { trust: 1 }, n: 6 };
    // Same reply (a Re-read, or a second line): no log, no amounts, exactly the older shape.
    const same = nextEvent(old, { ...base, reply: 5, date: 'May 1', log: logKept({ standing: { domains: { npc: { npcs: { a: { lastEvent: old } } } } } }, 'a', 5) });
    assert.equal(JSON.stringify(JSON.parse(same).events[1]), JSON.stringify({ src: 'story', ask: { trust: 1 }, tier: 'ordinary', held: false, note: '' }));
    assert.equal(readEvent(same).prev, undefined);
    assert.equal(logKept({ standing: { domains: { npc: { npcs: { a: { lastEvent: old } } } } } }, 'a', 6), true, 'a new reply may start the log');
    assert.equal(logKept({}, 'a', 5), true, 'a first read may');
    // The next reply: the old event becomes the first row (its own words; no amounts it never stored), and the new one has amounts.
    const next = readEvent(nextEvent(old, { ...base, reply: 6, date: 'May 2' }));
    assert.equal(next.prev.length, 1);
    assert.deepEqual(next.prev[0], { at: 5, n: 5, date: 'May 1', ask: { trust: 2 }, held: false, why: 'an old reason' });
    assert.deepEqual(next.events[0].mv, { trust: 1 });
    assert.equal(eventLog(next).length, 2);
    // A fresh chat's first event starts an empty log; five more replies keep only two earlier rows.
    let text = nextEvent('', { ...base, reply: 1, date: 'D' });
    assert.deepEqual(readEvent(text).prev, []);
    for (let reply = 2; reply <= 6; reply += 1) text = nextEvent(text, { ...base, reply, date: 'D', n: reply });
    assert.deepEqual(readEvent(text).prev.map(row => row.at), [5, 4]);
    assert.deepEqual(eventLog(readEvent(text)).map(row => row.at), [6, 5, 4]);
    assert.deepEqual(eventLog(null), []);
    assert.deepEqual(movesOf([{ meter: 'trust', before: 1, after: 3 }, { meter: 'tension', before: 4, after: 4 }, { meter: 'custom', before: 0, after: 2 }]), { trust: 2 });
    // A stored text with a bad log is unusable (the slice check reports it).
    assert.equal(readEvent(JSON.stringify({ ...JSON.parse(text), prev: [{ at: 1 }] })), null);
});

test('last three changes: a long reason on every row keeps the newest event and drops the oldest log row, never the new event', () => {
    const why = `${'word '.repeat(60)}`.trim();
    const base = { src: 'story', ask: { trust: 1, affection: 1, desire: 1, tension: 1 }, tier: 'ordinary', held: false, note: '', mv: { trust: 1 }, why };
    let text = '';
    for (let reply = 1; reply <= 5; reply += 1) text = nextEvent(text, { ...base, reply, date: 'January 12' });
    const out = readEvent(text);
    assert.ok(out && text.length <= 2600 && out.events[0].why);
    assert.equal(out.at, 5);
});

test('last three changes: Recent changes lists a chat from before the log by the stored history, without repeating a reply the log shows', () => {
    const npc = { relationship: {}, recentMeterChanges: [{ n: 9, date: 'May 2', mv: { trust: 2 }, ask: {}, held: false, note: '', why: 'kept' }], recentRelationshipChanges: [{ impact: 'ordinary', axes: ['trust'], reason: 'dup', message: 9 }, { impact: 'meaningful', axes: ['desire'], reason: 'earlier', message: 4 }] };
    const html = withSectionHtml(npc);
    assert.equal((html.match(/class="delta-chg"/g) || []).length, 2);
    assert.match(html, /kept/); assert.match(html, /earlier/); assert.doesNotMatch(html, /dup/);
    assert.match(withSectionHtml({ relationship: {} }), /No relationship change recorded yet/);
});

test('last three changes: the Recent changes rows wrap on phone, tablet and desktop (the shared row rule has no width or truncation clamp)', () => {
    const root = fileURLToPath(new URL('../../modules/people/legacy', import.meta.url));
    const css = fs.readFileSync(path.join(root, 'dossier-ui-styles-sections.js'), 'utf8');
    const row = css.split('\n').find(line => line.includes('.delta-chg {')) || '';
    assert.ok(row && !/text-overflow|line-clamp|nowrap|max-height/.test(row));
    const via = css.split('\n').find(line => line.includes('.delta-chg-via {')) || '';
    assert.ok(via && !/text-overflow|line-clamp|nowrap/.test(via));
    assert.match(css.split('\n').find(line => line.includes('.delta-chg > div {')), /min-width:0/);
});
