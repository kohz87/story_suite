// A short delete fuzz for CI (the b1-capture harness's FUZZ_DELETE mode, cut down to Story Director's
// lines): a few seeds of 20 replies, each with a middle exchange deleted twice along the way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../packages/story-block/testkit/index.js';
import { createFakeModel } from '../../../../packages/story-block/testkit/model.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { castPlans } from '../../../../modules/cast/cast/index.js';
import { fakeFightRunner } from '../../integration/director/helpers/fake-fight-runner.js';
import { problemList } from '../../../../modules/time/tracker/domain.js';
import { fakeDelta } from '../../../modules/cast/keypeople/helpers.js';
import { LASTING_PACK, lastingEdit, lastingLines } from '../../../modules/world/chronicle/helpers/lasting-pack.js';
import {
    BASE, BASE_OFFERS, BASE_PLACES, BASE_WORLD, CAST_IDS, FACTIONS, KEY_BASE, NEAR, RIPPLES, SOUGHT_ASK, STATES, TIE,
    castAnswer, castEdits, castEntry, editOf, expectedClock, keyEdits, keyLines, nameLines, nearLines, prng, replyLines,
    said, seedCrypto, timeOf, tripLines, validatorErrors, word, wrenEntry, ylvaEntry,
} from './fuzz-delete.helpers.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 24, 25, 26, 27, 28, 29, 30, 31, 32, 108];
// Seeds from EXTRAS_FROM carry the last days' lines (dayLines, the quiet switch); seeds 1-3 keep the stories the aggregate checks below were set on.
const EXTRAS_FROM = 4;
const REPLIES = 20;
const DELETE_AT = [10, 16, 20];
// The reply after which the reader adds "copper bit" and "gold" under Settings → Coins: rewards owed then count.
const COINS_AT = 7;

// (stage73) Offers with no deadline (own stream): a hook with a giver and a reward and no `due:`, offered and then now and then
// kept open by a later reply's line that touches it (the first reply's two offers, which no delete takes, are mentioned now and
// then, so the lapse clock starts over), and a jump of days now and then so some lapse (UNDATED_OFFER_DAYS). A reply's own offers
// are never named by a later reply (a delete would take the thing the line names).
function offerLines(ro, n, made) {
    const lines = [];
    if (ro.chance(0.55)) {
        const key = `${word(ro)}${String(n).padStart(2, '0')}55`;
        made.push(key);
        lines.push(`+ hook ${key} — a job on offer | giver: Brom | reward: ${ro.int(1, 30)} gold`);
    }
    if (ro.chance(0.4)) {
        offerMentions += 1;
        lines.push(`~ hook ${ro.pick(BASE_OFFERS)} | now: still wanted`);
    }
    if (ro.chance(0.25)) lines.push(`! time +${ro.int(1, 4)}d`);
    return lines;
}

// (night 12 Nov) The last days' kinds, from a stream of their own: world lines that name factions, places inside a town,
// a cast person who arrives and leaves inside one reply, and the reader's quiet scene switch.
let factionLines = 0;
let quietFlips = 0;
let passersBy = 0;
let passersMet = 0;
let swipes = 0;
function dayLines(rd, n) {
    const lines = [];
    if (rd.chance(0.4)) {
        factionLines += 1;
        lines.push(`+ world Faction${n} — afoot | state: ${rd.pick(STATES)} | factions: ${rd.pick(FACTIONS)}, ${rd.pick(['Faction', 'Clan'])} ${n}${rd.int(1, 2)}`);
    }
    if (rd.chance(0.25)) lines.push(`~ world ${rd.pick(BASE_WORLD)} | factions: ${rd.pick(FACTIONS)}`);
    if (rd.chance(0.3)) lines.push(`~ place ${BASE_PLACES[0]} / Spot${n}`, ...(n % 2 ? [`~ place ${BASE_PLACES[0]}`] : []));
    if (rd.chance(0.3)) {
        passersBy += 1;
        // Wren is not one of CAST_IDS (their names are never told outside a cue); the reply's text names her, so the meeting counts as seen.
        lines.push('+ present Wren', '- present Wren');   // the reply's text does not name her: only the scene lines show her (cast seenKeys)
        lines.passer = true;
    }
    // An off-screen agenda with dates: the pulse's arrival and schedule-shift effects write its `arrive` / `on` (a thread another reply may have made).
    if (rd.chance(0.3)) lines.push(`+ agenda Sched${n} — plots | now: the docks | on: June ${rd.int(10, 25)}, 1200, 09:00 am | arrive: June ${rd.int(10, 25)}, 1200, 02:00 pm`);
    return lines;
}

let soughtRumors = 0;
let soughtMeetings = 0;
// Near-name quest lines that settled on the quest (counted over all seeds, asserted after them).
let nearPicks = 0;
let nearLinesMade = 0;
let tieLinesMade = 0;
// Undated offers (counted over all seeds): lines that mention one again, and those time closed as lapsed.
let offerMentions = 0;
let undatedLapsed = 0;

for (const seed of SEEDS) {
    test(`delete fuzz, seed ${seed}: ${REPLIES} replies with middle deletes replay cleanly`, async t => {
        t.mock.method(console, 'warn', () => {});
        const restore = seedCrypto(seed);
        const r = prng(seed);
        const ra = prng(seed ^ 0xA5C);
        const rl = prng(seed ^ 0x1A57);
        const rt = prng(seed ^ 0x7121);
        const rk = prng(seed ^ 0x4B50);
        const rc = prng(seed ^ 0xCA57);
        const rs = prng(seed ^ 0x50C7);
        const re = prng(seed ^ 0xC10C);
        const rn = prng(seed ^ 0x4EA2);
        const ro = prng(seed ^ 0x0FFE);
        const rd = prng(seed ^ 0xD0A5);
        // Some seeds start with Trips off and switch it on at reply 4, so the rest-days mark (atlas.mark, which rides on the head reply) lands on a
        // reply the delete can take (CLAUDE.md rule 3); the others keep it on from the start (the mark on the first reply, never deleted).
        const lateTrips = seed >= EXTRAS_FROM && seed % 2 === 1;
        const madeOffers = [...BASE_OFFERS];
        const source = { version: '1.0.0', enabled: true, entries: [] };
        source.entries = [...CAST_IDS.map(id => castEntry(id, rc, source.version)), ylvaEntry(source.version), wrenEntry(source.version)];
        castPlans.clear();
        let host = null;
        const delta = Object.fromEntries(KEY_BASE.map(name => [name, {}]));
        const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), callModel: request => host.sdk.callModel(request), chat: () => host.ctx.chat } });
        host = await createHost({ modules: [fakeFightRunner(), fakeDelta(delta), module], callModel: createFakeModel([], { fallback: castAnswer(rc, rs) }), settings: { features: { 'story-director.names': true, 'story-director.trip': !lateTrips }, modules: { 'story-director': { 'cast.faces': 'day2', 'cast.unmetDie': rc.chance(0.5) } } } });
        // The cast is a real pack, installed (and switched on or off) as the fuzz edits it.
        const installCast = async () => {
            const pack = { id: 'ersveil', version: source.version, name: 'Ersveil', requires: { storyBlock: '^2' }, ripples: RIPPLES, content: { cast: source.entries.map(({ pack: _pack, packVersion: _version, ...own }) => ({ ...own, start: Object.fromEntries(Object.entries(own.start).filter(([key, value]) => key !== 'routine' || value)) })) } };
            { const done = await host.packs.packs.install(JSON.stringify(pack), { origin: 'cast-fuzz' }); assert.equal(done.ok, true, JSON.stringify(done)); }
            await host.packs.packs.setEnabled('ersveil', source.enabled);
        };
        await installCast();
        try {
            assert.equal((await host.packs.packs.install(LASTING_PACK, { origin: 'pack.json' })).ok, true);
            await host.send('Hello.', said('The road.', ['~ time June 3, 1200, 08:00 am', `~ place ${BASE_PLACES[0]} | kind: town`, ...BASE.map(key => `+ hook ${key} — an old tale | now: the inn`),
                ...BASE_OFFERS.map(key => `+ hook ${key} — a job on offer | giver: Brom | reward: 8 gold`),
                ...BASE_PLACES.map(place => `+ landmark ${place} | region: Vale | kind: town`),
                ...BASE_WORLD.map(key => `+ world ${key} — afoot | state: ongoing`)]));
            for (const name of KEY_BASE) assert.ok((await host.sdk.command('keypeople.pin', { name })).ok);
            const start = host.head().domains.director.time.minutes;
            const times = new Map();
            let wrenMet = false;
            let quietOn = false;
            let editsMade = 0;
            let sought = '';
            const clock = () => host.head().domains.director.time.minutes;
            for (let n = 1; n <= REPLIES; n += 1) {
                if (lateTrips && n === 4) host.features.set('story-director.trip', true);
                const near = nearLines(rn, n);
                const day = seed >= EXTRAS_FROM ? dayLines(rd, n) : [];
                const lines = [...replyLines(r, n), ...near.lines, ...lastingLines(rl), ...(lateTrips && n < 4 ? [] : tripLines(rt, n)), ...keyLines(rk, host, n), ...nameLines(rk, n), ...offerLines(ro, n, madeOffers), ...day];
                const seeking = rs.chance(0.6) ? rs.pick(SOUGHT_ASK) : '';
                // The planner's answer is used by the reply after the one it was asked about: the reply after a request for her names her too.
                const names = seeking === 'cartographer' || sought === 'cartographer';
                sought = seeking;
                const replyText = said(`Reply ${n}.${names ? ' Ylva nods.' : ''}`, lines);
                await host.send(seeking ? `Is there a ${seeking} around (${n})?` : r.chance(0.3) ? 'I take the job.' : `On we go (${n}).`, replyText);
                // A swipe of the reply now and then (the same lines again): the pulse is rolled again, the steps of the reply are redone.
                if (seed >= EXTRAS_FROM && rd.chance(0.12)) {
                    swipes += 1;
                    await host.swipe(replyText);
                }
                if (day.passer && !wrenMet && host.head().domains.cast.people['ersveil:wren']?.met) { passersMet += 1; wrenMet = true; }
                if (!host.head().domains.cast.people['ersveil:wren']?.met) wrenMet = false;
                if (host.head().domains.cast.people['ersveil:ylva']?.met?.why === 'sought') soughtMeetings += 1;
                if (near.tie) {
                    tieLinesMade += 1;
                    const director = host.head().domains.director;
                    const quest = Object.values(director.threads).find(thread => thread.key === `${near.base} ${TIE.quest}`);
                    const hook = Object.values(director.threads).find(thread => thread.key === `${near.base} ${TIE.hook}`);
                    assert.ok(quest && hook, `seed ${seed}, reply ${n}: the tie's hook and quest exist`);
                    assert.equal(quest.status, 'active', `seed ${seed}, reply ${n}: a tie leaves the quest open`);
                    assert.equal(hook.status, 'active', `seed ${seed}, reply ${n}: a tie leaves the hook open`);
                    const unclear = problemList(director).find(problem => problem.kind === 'unknown-key' && problem.key === `${near.base} ${TIE.line}`);
                    assert.ok(unclear, `seed ${seed}, reply ${n}: the tie is reported as unclear`);
                    assert.deepEqual(unclear.candidates.slice().sort(), [quest.key, hook.key].sort());
                } else if (near.base) {
                    // The line read as the quest (a near-key note), not the hook beside it: the quest took it, the hook is as it was.
                    nearLinesMade += 1;
                    const director = host.head().domains.director;
                    const named = `${near.base} ${NEAR.line}`;
                    const quest = Object.values(director.threads).find(thread => thread.key === `${near.base} ${NEAR.quest}`);
                    const hook = Object.values(director.threads).find(thread => thread.key === `${near.base} ${NEAR.hook}`);
                    assert.ok(quest && hook, `seed ${seed}, reply ${n}: the hook and the quest exist`);
                    assert.equal(hook.status, 'active', `seed ${seed}, reply ${n}: the hook is left alone`);
                    assert.ok(problemList(director).some(problem => problem.kind === 'near-key' && problem.key === named), `seed ${seed}, reply ${n}: "${named}" read as a near key`);
                    assert.equal(director.keys[named.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()], quest.id, `seed ${seed}, reply ${n}: the name is the quest's alias`);
                    if (near.close) assert.equal(quest.status, 'resolved', `seed ${seed}, reply ${n}: the quest was closed`);
                    else assert.equal(quest.fields.step, 'Seal the burrow', `seed ${seed}, reply ${n}: the quest took the step`);
                    nearPicks += 1;
                }
                await castPlans.idle();
                castEdits(rc, source, n);
                await installCast();
                times.set(host.ctx.chat.at(-1), timeOf(lines));
                if (n === COINS_AT) host.settings.set('story-block', 'coins', [{ name: 'copper bit', plural: 'copper bits', value: 1 }, { name: 'gold', value: 100 }]);
                assert.equal(clock(), expectedClock(host.ctx.chat, times, start), `seed ${seed}, reply ${n}: the clock (live)`);
                // The reader's arc commands (own random stream, so the story's lines stay as they were): an
                // accepted plan of its own names now and then, and sometimes End arc.
                if (ra.chance(0.3)) {
                    const plan = [`ARC: Arc${n} — the tide turns`, `BEAT: Beat${n}a — a bell | place: the quay`, `BEAT: Beat${n}b — a storm | after: Beat${n}a`, `AGENDA: Agent${n} — schemes | now: the docks`, `SECRET: Secret${n} — hidden`].join('\n');
                    const accepted = await host.sdk.command('director.arc.accept', { plan });
                    assert.ok(accepted.ok, accepted.message);
                } else if (ra.chance(0.15) && host.sdk.query('director.arc')?.current?.active) {
                    assert.ok((await host.sdk.command('director.arc.end', {})).ok);
                }
                await keyEdits(rk, host, n, delta);
                // The reader's quiet scene switch now and then, on the latest reply (a delete may take it back).
                // On for a reply or two, then off again, so the pulse is not starved for the rest of the chat.
                if (seed >= EXTRAS_FROM && (quietOn || rd.chance(0.2))) {
                    quietFlips += 1;
                    quietOn = !quietOn;
                    assert.ok((await host.sdk.command('director.pulse.quiet', { on: quietOn })).ok, `seed ${seed}, reply ${n}: quiet scene switch`);
                }
                // The reader sets the clock by hand now and then, forward or back; the model follows (a set, exact).
                if (re.chance(0.3)) {
                    const edit = editOf(re);
                    const done = await host.sdk.command('director.clock', edit.payload);
                    assert.ok(done.ok, `seed ${seed}, reply ${n}: ${done.message}`);
                    times.get(host.ctx.chat.at(-1)).push({ edit: edit.abs });
                    editsMade += 1;
                    assert.equal(clock(), expectedClock(host.ctx.chat, times, start), `seed ${seed}, reply ${n}: the clock after the reader's edit`);
                }
                const edit = lastingEdit(rl, host, n);
                if (edit) assert.ok((await host.sdk.command('chronicle.edit', edit)).ok, `seed ${seed}, reply ${n}: the reader's edit`);
                if (!DELETE_AT.includes(n)) continue;
                // A middle exchange in the first half (so many replies come after it): never the first.
                const chat = host.ctx.chat;
                const users = chat.map((message, i) => (message.is_user ? i : -1)).filter(i => i > 2 && i < chat.length / 2);
                // Often one whose reply holds a world pick (chronicle.surface) or an NPC initiative pick
                // (director.initiative: Fenna gives jobs and is now and then present) with replies after it.
                const picks = host.sdk.receipts().filter(entry => entry.receipt.type === 'chronicle.surface').map(entry => entry.index);
                // The initiative step is kept on the reader's message before the reply it is for.
                const initiative = host.sdk.receipts().filter(entry => entry.receipt.type === 'director.initiative').map(entry => entry.index);
                const picked = users.filter(i => picks.includes(i + 1) || initiative.includes(i));
                // Or one whose reply made a quest a later settle lapsed (its closing is then passed over).
                const lapsed = new Set(host.sdk.receipts().filter(entry => entry.receipt.type === 'time.settle').flatMap(entry => entry.receipt.data?.lapsed ?? []).map(entry => entry.key));
                const lapsedHere = users.filter(i => [...lapsed].some(key => chat[i + 1]?.mes?.includes?.(`+ quest ${key} `)));
                const user = lapsedHere.length && r.chance(0.6) ? r.pick(lapsedHere) : picked.length && r.chance(0.5) ? r.pick(picked) : r.pick(users);
                // A reward owed that was paid since (thread.owed.paid): deleting the reply that closed the quest takes the
                // payment's block with it (it depends on the debt), which Story Block reports as skipped, so it is
                // not "a later block no longer applies" for any other reason.
                const closedHere = Object.values(host.head().domains.director.threads).filter(thread => thread.owed?.paid && String(chat[user + 1]?.mes).includes(`- quest ${thread.key} `));
                const dump = JSON.stringify(chat.slice(user, user + 2).map(message => message.mes));
                await host.st.deleteMessage(user + 1);
                await host.st.deleteMessage(user);
                const where = `seed ${seed}, reply ${n}, deleted ${user}`;
                const skipped = host.store.problems().map(problem => problem.why ?? problem.message);
                if (closedHere.length) assert.ok(skipped.length <= closedHere.length * 2 + 1, `${where}: only the payments of the deleted turn-in are skipped (${skipped.join(' / ')})`);
                else assert.deepEqual(skipped, [], `${where}: a later block no longer applies; the deleted pair: ${dump}`);
                const live = JSON.stringify(host.head());
                const shown = JSON.stringify([host.sdk.query('director.world'), host.sdk.query('director.journal'), host.sdk.query('ripples.sway'), host.sdk.query('chronicle.factions')]);
                host.store.rebuild();
                assert.equal(JSON.stringify(host.head()), live, `${where}: rebuild != live`);
                assert.equal(JSON.stringify([host.sdk.query('director.world'), host.sdk.query('director.journal'), host.sdk.query('ripples.sway'), host.sdk.query('chronicle.factions')]), shown, `${where}: World, Journal, sway and factions after a rebuild`);
                assert.deepEqual(validatorErrors(host), [], where);
                assert.equal(clock(), expectedClock(host.ctx.chat, times, start), `${where}: the clock`);
            }
            await host.send('And then?', 'Quiet.');
            assert.deepEqual(validatorErrors(host), [], `seed ${seed}: the head state`);
            assert.ok(editsMade >= 1, `seed ${seed}: the reader set the clock by hand`);
            t.diagnostic(`seed ${seed}: clock edits ${editsMade}`);
            assert.ok(host.sdk.receipts().some(entry => entry.receipt.type === 'events.fire' && entry.receipt.data?.then?.includes('chronicle.lasting')), `seed ${seed}: a pack event wrote a lasting change`);
            const summaries = host.sdk.receipts().map(entry => entry.receipt.summary ?? '');
            const tripsMade = summaries.filter(text => /^On the road to /.test(text)).length;
            assert.ok(tripsMade >= 1, `seed ${seed}: the fuzz set out on a trip`);
            const castDone = summaries.filter(text => /^(The cast|Paths crossed)/.test(text));
            soughtRumors += host.sdk.receipts().filter(entry => entry.receipt.type === 'cast.rumor').length;
            t.diagnostic(`seed ${seed}: rumors ${host.sdk.receipts().filter(entry => entry.receipt.type === 'cast.rumor').length}, sought meetings seen so far ${soughtMeetings}`);
            assert.ok(castDone.length >= 1, `seed ${seed}: the cast joined the world`);
            const world = Object.values(host.head().domains.cast.people);
            t.diagnostic(`seed ${seed}: cast steps ${castDone.length} (met ${castDone.filter(text => /^Paths crossed/.test(text)).length}, moved ${castDone.filter(text => /moved on/.test(text)).length}), people ${world.length}, met ${world.filter(person => person.met).length}, dead ${world.filter(person => !person.alive).length}`);
            // A pulse chance meeting may name the person too, but only alongside that person's cast introduction.
            const told = host.st.promptLog.filter(entry => entry.value).flatMap(entry => {
                const lines = String(entry.value).split('\n');
                return lines.filter(line => {
                    const meeting = /^World this reply: (.+?) crosses your path in .+, by chance\.$/.exec(line);
                    return !line.startsWith('[Cast]') && !(meeting && lines.some(other => other.startsWith(`[Cast] ${meeting[1]} comes into the scene in this reply`)));
                });
            });
            // A rumor describes; it never names (it is a [Cast] line too, so it is checked on its own).
            const rumors = host.st.promptLog.filter(entry => entry.value).flatMap(entry => String(entry.value).split('\n')).filter(line => line.startsWith('[Cast] People here know of'));
            for (const id of [...CAST_IDS, 'ylva']) assert.ok(!rumors.some(line => new RegExp(`\\b${id}\\d*\\b`, 'i').test(line)), `seed ${seed}: ${id} is named in a rumor`);
            for (const id of CAST_IDS) {
                const leaked = told.find(line => new RegExp(`\\b${id}\\d*\\b`, 'i').test(line));
                assert.equal(leaked, undefined, `seed ${seed}: ${id} is named outside a meeting's cue: ${leaked}`);
            }
            const keyDone = summaries.filter(text => /^Key person: /.test(text));
            assert.ok(keyDone.length >= 1, `seed ${seed}: the fuzz sent a key person away`);
            t.diagnostic(`seed ${seed}: key people receipts ${keyDone.length} (away ${keyDone.filter(text => / is away/.test(text)).length}, back ${keyDone.filter(text => / is back/.test(text)).length}, steps ${keyDone.filter(text => /^Key person: \w+, /.test(text)).length}, died ${keyDone.filter(text => /died/.test(text)).length}, archived in Delta ${keyDone.filter(text => /archived in NPC State Delta/.test(text)).length}), lines told ${Object.values(host.head().domains.keypeople.notes).filter(note => note.key !== undefined).length}, pinned now ${Object.keys(host.head().domains.keypeople.pins).length}`);
            t.diagnostic(`seed ${seed}: faction lines ${factionLines}, quiet flips ${quietFlips}, passers-by ${passersBy}, pulse steps ${host.sdk.receipts().filter(entry => entry.receipt.type === 'director.pulse').length}, passers met ${passersMet}, swipes ${swipes}, pulse kinds ${JSON.stringify(Object.fromEntries(host.sdk.receipts().filter(entry => entry.receipt.type === 'director.pulse').map(entry => entry.receipt.data?.kind).reduce((map, kind) => map.set(kind, (map.get(kind) ?? 0) + 1), new Map())))}, rumour events ${Object.values(host.head().domains.chronicle.events).filter(event => event.rumour !== undefined).length}, new factions ${host.sdk.receipts().filter(entry => /New factions?:/.test(entry.receipt.summary ?? '')).length}, places with a parent ${Object.values(host.head().domains.atlas?.places ?? {}).filter(place => place.parent).length}, sway ${JSON.stringify((host.sdk.query('ripples.sway') ?? []).map(power => power.sway))}`);
            assert.ok(!source.enabled || host.sdk.query('ripples.sway')?.length === 2, `seed ${seed}: the pack's ripples table is read`);
            t.diagnostic(`seed ${seed}: trips set out ${tripsMade}, delayed ${summaries.filter(text => /is delayed/.test(text)).length}, stopped ${summaries.filter(text => /^The trip to .* ends/.test(text)).length}`);
            t.diagnostic(`seed ${seed}: pack events that fired: ${[...new Set(host.sdk.receipts().filter(entry => entry.receipt.type === 'events.fire').map(entry => entry.receipt.data?.event?.split('/')[1]))].join(', ')}`);
            undatedLapsed += host.sdk.receipts().filter(entry => entry.receipt.type === 'time.settle')
                .flatMap(entry => entry.receipt.data?.lapsed ?? []).filter(entry => madeOffers.includes(entry.key)).length;
            const again = await createHost({ modules: [fakeFightRunner(), createModule()] });
            try {
                await again.st.loadChat(structuredClone(host.ctx.chat));
                assert.deepEqual(again.store.problems(), [], `seed ${seed}: a fresh load skips nothing`);
                assert.equal(JSON.stringify(again.head().domains), JSON.stringify(host.head().domains), `seed ${seed}: fresh replay != live`);
            } finally {
                again.close();
            }
        } finally {
            host.close();
            restore();
        }
    });
}

test('delete fuzz: the reader sought a kind of person and the cast answered (a meeting, a rumor) in the seeds', () => {
    assert.ok(soughtMeetings > 0, 'a person the reader sought came in');
    assert.ok(soughtRumors > 0, 'a person the reader sought who was elsewhere was heard of');
});

test('delete fuzz: a person who passed through a scene inside one reply counted as met', t => {
    t.diagnostic(`passers-by ${passersBy}, met ${passersMet}`);
    assert.ok(passersMet > 0, 'a person who arrived and left inside one reply was met');
});

test('delete fuzz: near-name quest lines were reached, and settled on the quest', t => {
    t.diagnostic(`near-name quest lines ${nearLinesMade}, settled on the quest ${nearPicks}`);
    assert.ok(nearPicks > 0, 'the narrowing picked a quest at least once');
    assert.equal(nearPicks, nearLinesMade);
});

test('delete fuzz: tied near-name quest lines were reached, and stayed unclear', t => {
    t.diagnostic(`tied quest lines ${tieLinesMade}`);
    assert.ok(tieLinesMade > 0, 'a tie was made at least once');
});

test('delete fuzz: offers with no deadline were mentioned again, and time closed some as lapsed', t => {
    t.diagnostic(`undated offers mentioned again ${offerMentions}, lapsed ${undatedLapsed}`);
    assert.ok(offerMentions > 0, 'an undated offer was mentioned again at least once');
    assert.ok(undatedLapsed > 0, 'an undated offer lapsed at least once');
});
