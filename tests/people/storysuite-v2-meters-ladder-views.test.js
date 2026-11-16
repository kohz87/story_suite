import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTemplate } from '../../ui/legacy/view/template/index.js';
import { validateScreen } from '../../ui/legacy/view/screens.js';
import { MODULE_ID, meterBarNode } from '../../modules/people/storysuite-v2.js';
import { DEFAULT_CHANGE_CAP, FEATURE_DRIFT, FEATURE_PRESETS, FEATURE_STAGES, createNpcPart, normalizeMeterSettings, parseNeeds, secretId, secretsFromLines, secretsToLines, validateNpcSlice } from '../../modules/people/meters/npc-meters.js';
import { metersCardScreen } from '../../modules/people/meters/npc-meters-screen.js';
import { v2MetersHtml, v2MetersProjection, v2SecretsHtml } from '../../modules/people/legacy/dossier-ui.js';
import { fakeRoot, fakeDocument } from './helpers/fake-dom.js';
import { withoutDossiers } from './helpers/seed-people.js';
import { DATING_PACK, LADDER, SECRET, dossiers, fuzzSeeds, lastReceipt, prng, suite } from './storysuite-v2-meters-ladder.helpers.js';

// ---- 4. locked-note teasers ----

test('teasers: a locked note shows only that it is hidden and its rule (no title, no text, no icon); opened, its title and text', async () => {
    const s = await suite({ settings: { ladder: LADDER } });
    await s.say(['~ npc Mira | trust: +5']);
    const leaks = () => [
        JSON.stringify(s.host.sdk.query('npc.cast')), JSON.stringify(withoutDossiers(s.host.head())), s.def.context.static(),
        JSON.stringify(s.adapter.dossierMeters(Object.values(s.delta.records))),
    ].some(text => text.includes('lost heir') || text.includes('Her past'));
    const mira = () => s.host.sdk.query('npc.cast').find(entry => entry.key === 'npc_mira');
    assert.deepEqual(mira().locked, [{ id: secretId('trust', 30, SECRET), meter: 'trust', at: 30, event: false, opens: 'Opens at Trust 30', text: 'Hidden note · opens at Trust 30' }]);
    assert.equal(leaks(), false);
    const el = fakeRoot();
    s.def.tabs[0].render(el);
    assert.match(el.innerHTML, /Hidden note · opens at Trust 30/);
    assert.doesNotMatch(el.innerHTML, /lost heir|Her past|🔒|🔓/);
    await s.say(['~ npc Mira | trust: +15']);
    assert.deepEqual(mira().locked, []);
    assert.deepEqual(mira().opened, [{ id: secretId('trust', 30, SECRET), title: 'Her past', text: 'Opened · Trust 30' }]);
    s.def.tabs[0].render(el);
    assert.match(el.innerHTML, /<b>Her past<\/b>: She was the lost heir of House Venn\./, 'once unlocked, the Cast tab shows it');
    assert.doesNotMatch(el.innerHTML, /🔒|🔓/);
    assert.ok(s.def.context.tail(s.view()).lines.includes(`Mira, known to the player now; may come out: ${SECRET}`));
});

test('teasers: editor lines carry an optional [title]; the id does not depend on it', () => {
    const { secrets } = secretsFromLines('trust 60: [Her past] She was the heir.\ntension -20: Hates the river.');
    assert.deepEqual(secrets.map(({ meter, at, title, text }) => ({ meter, at, title, text })), [
        { meter: 'trust', at: 60, title: 'Her past', text: 'She was the heir.' },
        { meter: 'tension', at: -20, title: undefined, text: 'Hates the river.' },
    ]);
    assert.equal(secrets[0].id, secretId('trust', 60, 'She was the heir.'), 'a title never locks a note again');
    assert.equal(secretsToLines(secrets), 'trust 60: [Her past] She was the heir.\ntension -20: Hates the river.');
});

// ---- 5. custom meters in the dossier view ----

test('the dossier view shows custom meters, the ladder line, milestones and teasers (escaped); nothing without a host', async () => {
    const s = await suite({ settings: { ladder: LADDER, customMeters: [{ name: '<Awe>', min: 0, max: 50 }] } });
    await s.say(['~ npc Mira | awe: +7 | trust: +12', '+ milestone Mira — saved her brother']);
    const views = s.adapter.dossierMeters(Object.values(s.delta.records));
    // (people store P4) every stored person has a view: npc.cast is the store's people, Oren at the meters he would start at.
    assert.deepEqual(Object.keys(views), ['npc_mira', 'npc_oren']);
    const projection = v2MetersProjection(views.npc_mira);
    assert.deepEqual(projection.bars.map(bar => [bar.id, bar.value, bar.max]), [['awe', 7, 50]], 'only the meters beyond the four axes');
    assert.equal(projection.rank, 'Friend');
    assert.deepEqual(projection.milestones, ['saved her brother']);
    const html = v2MetersHtml(projection);
    assert.match(html, /&lt;Awe&gt;/);
    assert.doesNotMatch(html, /<Awe>/);
    assert.match(html, /Next: Confidant — trust 22\/60, affection 0\/40/);
    assert.doesNotMatch(html, /Her past|Hidden note|🔒/, 'the notes are in their own Secrets section, not among the meters');
    const secrets = v2SecretsHtml(projection);
    assert.match(secrets, /Secrets <small class="delta-secrets-count">· 0 opened · 1 still hidden<\/small>/);
    assert.match(secrets, /delta-secret-bar[^>]*><\/span><span class="delta-secret-when">Opens at Trust 30<\/span>/);
    assert.doesNotMatch(secrets, /Her past|lost heir|🔒/, 'a hidden note is a bar and its rule');
    assert.equal(v2MetersHtml(v2MetersProjection(null)), '');
    assert.equal(v2SecretsHtml(v2MetersProjection(null)), '');
    s.adapter.stop();
    assert.deepEqual(s.adapter.dossierMeters(Object.values(s.delta.records)), {});
});

// ---- 6. meter bars with ss.meter's newer props ----

test('bars carry ceiling, ticks and the latest reply\'s delta; a host whose ss.meter lacks them gets them in the text', async () => {
    const records = dossiers();
    records.npc_mira.meterSetup = { limits: { trust: { ceiling: 70 } } };
    const s = await suite({ records, settings: { ladder: LADDER, stages: [{ meter: 'trust', at: 50, name: 'Close' }] } });
    await s.say(['~ npc Mira | trust: +12']);
    const bar = s.host.sdk.query('npc.cast').find(entry => entry.key === 'npc_mira').bars.find(item => item.id === 'trust');
    assert.deepEqual(bar.ticks, [{ at: 20, label: 'Friend' }, { at: 50, label: 'Close' }, { at: 60, label: 'Confidant' }]);
    assert.equal(bar.ceiling, 70);
    assert.equal(bar.delta, 12);
    const html = meterBarNode(fakeDocument(), { id: 'trust', label: 'Trust', min: -100, max: 100, tone: 'info' }, 22, '', bar).serialize();
    assert.match(html, /npc-state-delta-v2-ceiling" style="--npc-state-delta-at: 0\.85"/);
    assert.match(html, /▲12/);
    assert.equal((html.match(/npc-state-delta-v2-tick/g) ?? []).length, 3);
    // A host that lists ss.meter's props without the new ones: the ceiling and the change go in the text.
    const old = await suite({ records, settings: { ladder: LADDER }, wrap: true });
    old.sdk.widgets = () => ({ 'ss.meter': { props: { value: {}, max: {}, min: {}, label: {}, tone: {}, text: {} } } });
    await old.say(['~ npc Mira | trust: +12']);
    const sdkCast = old.adapter.definition.queries['npc.cast'](old.host.head(), {});
    const folded = sdkCast.find(entry => entry.key === 'npc_mira').bars.find(item => item.id === 'trust');
    assert.equal(folded.text, '22 · max 70 ▲12');
    assert.equal('ceiling' in folded || 'delta' in folded || 'ticks' in folded, false);
});

test('the NPC card template compiles cleanly and passes the screen check', () => {
    assert.deepEqual(compileTemplate(metersCardScreen.template).warnings, []);
    assert.deepEqual(validateScreen(metersCardScreen), []);
    assert.match(metersCardScreen.template, /data-each="n\.still as b"/);
    assert.match(metersCardScreen.template, /data-each="n\.locked as l">\{\{ l\.text \}\}/);
});

// ---- 7. features ----

test('features: stages off — no milestone line, no ladder, no step; a host without the Features API uses the defaults', async () => {
    const s = await suite({ settings: { ladder: LADDER }, features: { [FEATURE_STAGES]: false } });
    await s.say(['~ npc Mira | trust: +15', '+ milestone Mira — saved her brother']);
    assert.equal(s.npc('Mira').rank, undefined);
    assert.equal(s.npc('Mira').milestones, undefined);
    assert.ok(s.host.turn.problems().some(problem => problem.code === 'FEATURE_OFF'));
    assert.equal((await s.sdk.command('npc.milestone', { name: 'Mira', add: ['x'] })).code, 'FEATURE_OFF');
    assert.equal(s.receipts().some(receipt => receipt.type === 'npc.tick'), false);
    const plain = createNpcPart({});
    assert.deepEqual([FEATURE_STAGES, FEATURE_DRIFT, FEATURE_PRESETS].map(id => plain.featureOn(id)), [true, false, true]);
    // An older host warns about the newer fields and keeps the module.
    const older = await suite();
    assert.ok(older.host.registry.module(MODULE_ID));
});

test('parsing: needs read several ways; bad parts are left out', () => {
    assert.deepEqual(parseNeeds('trust 60, affection >= 40 and tension <= -10 & nonsense'), [
        { meter: 'trust', at: 60, below: false }, { meter: 'affection', at: 40, below: false }, { meter: 'tension', at: -10, below: true },
    ]);
    assert.deepEqual(parseNeeds({ trust: 5, Respect: -3 }), [{ meter: 'trust', at: 5, below: false }, { meter: 'respect', at: -3, below: true }]);
    const settings = normalizeMeterSettings({ ladder: [{ name: 'A', needs: 'nonsense' }, { name: 'B', needs: 'trust 5', track: '__proto__' }, { name: 'C', milestone: 'met' }, ...Array.from({ length: 12 }, (_, i) => ({ name: `R${i}`, needs: `trust ${i}` }))] });
    assert.deepEqual(Object.keys(settings.ladder), ['']);
    assert.equal(settings.ladder[''].length, 8, 'at most eight rungs a track');
    assert.equal(settings.ladder[''][0].name, 'C', 'a rung with only a milestone is fine; one with nothing is left out');
    assert.equal(Object.getPrototypeOf(settings.ladder), Object.prototype);
});

test('validation: the new fields are checked', () => {
    const base = { name: 'A', meters: {}, stages: {}, unlocked: [] };
    const check = extra => validateNpcSlice({ npcs: { npc_a: { ...base, ...extra } }, problems: [] });
    assert.deepEqual(check({ milestones: { 'saved-her': 'saved her' }, rank: 'friend', low: 2, day: 3 }), []);
    assert.ok(check({ milestones: ['x'] }).length);
    assert.ok(check({ milestones: { 'Bad Key': 'x' } }).length);
    assert.ok(check({ rank: 'Not a key' }).length);
    assert.ok(check({ low: 0 }).length);
    assert.ok(check({ day: 1.5 }).length);
    assert.ok(check({ milestones: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`m${i}`, 'x'])) }).length);
});

// ---- 8. delete fuzz with the new lines ----

for (const seed of fuzzSeeds(process.env.FUZZ_SEEDS, [5, 17, 41])) {
    test(`delete fuzz seed ${seed}: meters, milestones, via gate, notes kinds and the per-reply step over middle deletes; replay equals rebuild`, async t => {
        t.mock.method(console, 'warn', () => {});
        const records = dossiers();
        records.npc_mira.meterSetup = { limits: { affection: { ceiling: 50 } } };
        const s = await suite({ records, settings: { ladder: LADDER, demoteAfter: 2, presets: ['rival'] } });
        const r = prng(seed);
        // The set-up reply makes both entries; it is never deleted.
        await s.say(['~ npc Mira | trust: +1', '~ npc Oren | trust: +1']);
        const setup = s.host.store.headIndex();
        const own = new Map();   // record sid → the milestones that reply added
        for (let step = 0; step < (Number(process.env.FUZZ_STEPS) || 18); step += 1) {
            const lines = [];
            const marks = [];
            for (let n = r.int(1, 3); n > 0; n -= 1) {
                const who = r.pick(['Mira', 'Oren']);
                switch (r.int(0, 9)) {
                    // The gate's `via:` (a repeat gives less, then backfires) and the notes kinds (lie, know, taste, tie), also under middle deletes.
                    case 5: lines.push(`~ npc ${who} | affection: +${r.int(1, 9)} | via: ${r.pick(['praise', 'gift', 'help', 'flirt', 'threat', 'shared-danger'])} | impact: ${r.pick(['ordinary', 'major'])}`); break;
                    case 6: lines.push(r.chance(0.5) ? `~ lie ${who} | to: ${r.pick(['Mira', 'Oren', 'Astra'])} | said: not me ${r.int(0, 3)}` : `~ lie ${who} | to: ${r.pick(['Mira', 'Oren', 'Astra'])} | caught: yes`); break;
                    case 7: lines.push(`~ know ${who} | about: ${r.pick(['Mira', 'Oren', 'Astra', 'Brann'])} | fact: keeps a ledger ${r.int(0, 3)} | ${r.pick(['how: saw | secret: yes', 'how: heard', 'told: yes'])}`); break;
                    case 8: lines.push(`~ taste ${who} | ${r.pick(['likes', 'dislikes'])}: ${r.pick(['tea', 'toffee', 'rain'])}`); break;
                    case 9: lines.push(`~ tie ${who} | with: ${r.pick(['Astra', 'Brann', 'Cole', 'Dova', 'Esk', 'Finn', 'Gale', 'Hobb', 'Ines'])} | tag: ${r.pick(['+', '-'])}${r.pick(['ally', 'rival', 'owes'])}`); break;
                    case 0: lines.push(`~ npc ${who} | trust: ${r.pick(['+', '-'])}${r.int(1, 15)} | affection: +${r.int(0, 9)}`); break;
                    // Past the change cap (B-a1-15): held to 15 a reply, also after a middle delete.
                    case 4: lines.push(`~ npc ${who} | trust: ${r.pick(['+', '-'])}${r.int(16, 40)}`); break;
                    case 1: lines.push(`~ npc ${who} | respect: +${r.int(1, 9)} | tension: ${r.pick(['+', '-'])}${r.int(1, 9)}`); break;
                    case 2: { const name = `deed ${step}-${n}`; lines.push(`+ milestone ${who} — ${name}`); marks.push(`${who}|${name}`); break; }
                    default: lines.push(`+ milestone ${who} — saved her brother`);
                }
            }
            const before = Object.fromEntries(['Mira', 'Oren'].map(who => [who, s.npc(who).meters]));
            const index = await s.say(lines, `Step ${step}.`);
            own.set(s.host.store.carrierSid(index), marks);
            // One reply moves each meter at most the change cap, whatever was deleted before it.
            for (const who of ['Mira', 'Oren']) {
                for (const [meter, value] of Object.entries(s.npc(who).meters)) {
                    assert.ok(Math.abs(value - before[who][meter]) <= DEFAULT_CHANGE_CAP, `seed ${seed} step ${step}: ${who}'s ${meter} moved ${value - before[who][meter]} in one reply`);
                }
            }
            if (step < 3 || !r.chance(0.4)) continue;
            const replies = s.host.ctx.chat.map((message, at) => (!message.is_user && at > setup && at < index ? at : -1)).filter(at => at >= 0);
            if (!replies.length) continue;
            const gone = r.pick(replies);
            own.delete(s.host.store.carrierSid(gone));
            await s.host.st.deleteMessage(gone);
            await s.host.st.deleteMessage(gone - 1);
            const label = `seed ${seed} step ${step} (deleted ${gone})`;
            assert.deepEqual(s.host.store.problems(), [], `${label}: nothing was skipped`);
            const head = JSON.stringify(s.host.head());
            assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), [], `${label}: the slice validates`);
            s.host.store.rebuild();
            assert.equal(JSON.stringify(s.host.head()), head, `${label}: replay equals rebuild`);
            // Each remaining reply's own milestones are there; the deleted reply's are gone.
            const kept = [...own.values()].flat();
            for (const mark of kept) {
                const [who, name] = mark.split('|');
                assert.equal(s.npc(who).milestones?.[name.replace(/ /g, '-')], name, `${label}: ${mark}`);
            }
            const deeds = ['Mira', 'Oren'].flatMap(who => Object.values(s.npc(who).milestones ?? {}).filter(name => name.startsWith('deed')).map(name => `${who}|${name}`));
            assert.deepEqual(deeds.sort(), [...kept].sort(), `${label}: no milestone of a deleted reply is left`);
        }
        assert.deepEqual(s.host.store.problems(), [], 'no replayed block was skipped');
    });
}

test('the meter setup is kept on the dossier and never reaches Delta\'s own prompts', async () => {
    const core = await import('../../modules/people/core/core.js');
    const npc = core.normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', present: true, role: 'Clerk', meterSetup: { track: 'rival-track-x', limits: { affection: { ceiling: 37 } } } });
    assert.deepEqual(npc.meterSetup, { track: 'rival-track-x', limits: { affection: { ceiling: 37 } } });
    const transcript = 'USER: Hello.\nASSISTANT: Mira smiles.';
    const options = { transcript, currentTranscript: transcript, existingNpcs: [npc], existingNpc: npc, targetNpc: npc, targets: [npc], targetName: 'Mira', dossierText: 'Name: Mira', userName: 'Ari', charName: 'C' };
    const texts = [
        core.buildScannerPrompt(options), core.buildNarrationCapturePrompt(options), core.buildProfileRefreshPrompt(options),
        core.buildRelationshipPassPrompt(options), core.buildInjection([npc], transcript, 1),
    ];
    for (const text of texts) assert.doesNotMatch(String(text), /rival-track-x|ceiling|meterSetup/);
});

// ---- standalone: Story Block alone (no RPG Battle, no Story Director), a dating sim from a pack ----


test('standalone: with Story Block alone, a pack\'s meter preset gives a dating sim its meters, words and stages', async () => {
    const records = dossiers();
    const s = await suite({ records, packs: [DATING_PACK] });
    assert.equal(s.host.sdk.modules().some(module => /battle|director/.test(module.id)), false, 'no RPG Battle and no Story Director');
    const presets = s.host.sdk.query('packs.content', { kind: 'meterPresets' });
    assert.equal(presets.length, 1, 'the pack is read through packs.content');
    // The reader turns the preset on (the settings block) and gives it to Mira (the dossier editor).
    s.setSettings({ presets: [presets[0].id] });
    records.npc_mira.meterSetup = { track: presets[0].id };
    assert.doesNotMatch(s.def.context.static(), /nerves/, 'a custom meter is named in no text (G2)');
    assert.match(s.def.context.static(), /Meter rules: regard How much they think of you after a date/);
    await s.say(['~ npc Mira | regard: +15 | trust: +15']);
    await s.say(['~ npc Mira | regard: +10']);
    assert.equal(s.npc('Mira').rank, 'Crush');
    assert.ok(s.def.context.tail(s.view()).lines[0].includes('Mira (Crush) trust 25, affection 0, desire 0, tension 0, regard fond, nerves 50'), JSON.stringify(s.def.context.tail(s.view())));
    for (let i = 0; i < 3; i += 1) await s.say(['~ npc Mira | regard: +15']);
    assert.equal(s.npc('Mira').rank, 'Sweetheart', 'a pack stage needs no milestone: its needs alone');
    assert.match(lastReceipt(s, 'capture.npc').summary, /Mira: now Sweetheart \(They hold your hand on the way home\)/, 'the pack stage\'s line is told');
    // No Story Director: no clock, so nothing drifts, and nothing fails.
    assert.equal(s.npc('Mira').meters.nerves, 50);
    assert.deepEqual(s.host.store.problems(), []);
    assert.deepEqual(s.host.turn.problems().filter(problem => problem.module === MODULE_ID), []);
});
