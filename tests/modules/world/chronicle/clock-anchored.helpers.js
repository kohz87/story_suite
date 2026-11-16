// Shared by the clock-anchored tests: the views a chat and a fresh telling of it are compared in.

import assert from 'node:assert/strict';

import { chronicleOf, reloadSame, said } from './note-cursor.helpers.js';

const FIRST = 438445;
const quiet = t => t.mock.method(console, 'warn', () => {});
const where = minutes => `d${Math.floor(minutes / 1440) - FIRST}@${minutes % 1440}`;
const placesByDay = host => Object.entries(chronicleOf(host).dayFacts ?? {}).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([, v]) => `${v.day - FIRST}:${v.places.join('/')}`);
// Every place but R2's own (an edited reply's own entry is written under the edit, the notes follow-up) in the stored entries.
const notR2 = host => placesByDay(host).map(entry => entry.replace('/Old Weir', '').replace('Old Weir/', '').replace(/:Old Weir$/, ':')).filter(entry => !entry.endsWith(':'));
const days = host => JSON.stringify(Object.fromEntries(Object.entries(chronicleOf(host).days ?? {}).map(([day, v]) => [Number(day) - FIRST, (Array.isArray(v) ? v[0] : v)?.line ?? v])));
const send = async (host, from, replies) => { for (const [i, lines] of replies.entries()) await host.send('On.', said(`R${from + i}.`, lines)); };

/** What the player sees of the clock: the head clock (`minutes`, and as a day and time), `chronicle.dayFacts` and the Journal's "today so far" (the receipts after the last note). */
function snap(host) {
    const minutes = host.head().domains.director.time.minutes;
    const q = host.sdk.query('chronicle.dayFacts', {});
    const c = chronicleOf(host).noted; const note = Array.isArray(c) ? c.at(-1) : c;
    const pending = host.sdk.query('chronicle.noteFacts', { after: note.rev, through: note.through, minutes: note.minutes, present: note.present }).entries.map(e => [e.day - FIRST, e.entry?.places]);
    return { minutes, at: where(minutes), dayFacts: { days: q.days.map(d => [d.day - FIRST, d.facts.places]), today: q.today - FIRST }, pending };
}

/** The live chat equals a fresh telling in what `snap` shows, the stored entries (R2's own aside) and the digests; a rebuild and a chat change equal live. */
function equal(live, fresh, name) {
    assert.deepEqual(snap(live), snap(fresh), `${name}: head clock, dayFacts, today so far`);
    assert.deepEqual(notR2(live), notR2(fresh), `${name}: stored entries`);
    assert.equal(days(live), days(fresh), `${name}: digests`);
    assert.equal(reloadSame(live), true, `${name}: a rebuild equals live`);
}

/** A chat change (SillyTavern reopens the chat from what was saved) leaves the chronicle and the head clock as they were. */
async function reopened(host, name) {
    const before = JSON.stringify([chronicleOf(host), snap(host)]);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify([chronicleOf(host), snap(host)]), before, `${name}: after a chat change`);
}

export { equal, quiet, reopened, send, snap };
