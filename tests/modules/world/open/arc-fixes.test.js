// Generated arcs, review fixes (REVARCS1 + REVARCS2, ruling 52): the count includes the opening and the ending, a major opening counts for the caps,
// only the checked fields are stored (never cut mid-JSON), a cut answer keeps its whole rows, the call asks for what the arc slots need,
// a timeout is asked once more, hidden titles match whitespace-blind, the ledger keeps a size, and the prompt shows the shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeWs, runDays } from '../../../../modules/world/daily/step.js';
import { checkAnswer, shapeAnswer } from '../../../../modules/world/daily/arc-plan.js';
import { capBlock } from '../../../../modules/world/daily/caps.js';
import { readOpenAnswer } from '../../../../modules/world/chronicle/world-daily/open-prompt.js';
import { ARC_SYSTEM, arcLine } from '../../../../modules/world/chronicle/world-daily/open-arc-prompt.js';
import { loreText } from '../../../../modules/world/chronicle/world-daily/open-context.js';
import { storeOpen } from '../../../../modules/world/chronicle/conditions/ledger.js';
import { answerFor, fakeModel, ledgerOpen, open, openHost, reply, settle, WORLD } from './open-host.helpers.js';
import { slotValue } from '../../../../modules/rpg/slot.js';

const row = (name, after = 2) => ({ name, summary: `${name} happens.`, people: ['warden'], effects: {}, after, within: 3 });
const bind = { place: 'Highmark', region: 'The March', realm: 'March Realm' };
const check = (steps, arcSteps, answer = {}) => {
    const spec = { ...WORLD, templates: [open('arc-t', { arc: { steps } })] };
    const { ws } = makeWs({ world: spec, today: 10, seed: 's' });
    return checkAnswer(ws, ws.templates.get('arc-t'), bind, { ...answerFor('k'), ...answer, arc: { steps: arcSteps, ending: row('End') } }, 10);
};
const said = (text, line) => reply(text, [line]);
const FALLBACK_WORLD = { ...WORLD, templates: [open('night-watch', { needs: ['unrest@place'], arc: { steps: [2, 4] } }), open('border-incident')] };
async function build(model, world = FALLBACK_WORLD) {
    const host = await openHost(model, world);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    for (const line of ['One.', 'Two.', 'Three.', 'Four.']) { await host.send(line, said(line, '! time +1h')); await settle(); }
    await host.send('Next day.', said('Dawn.', '! time +1d'));
    return host;
}

test('ruling 52: the count is every happening, opening and ending included (2 = opening + ending)', () => {
    assert.deepEqual(check([2, 2], []).errors, [], '2 happenings: no steps between');
    assert.match(check([2, 2], [row('A')]).errors.join(' '), /2 to 2 happenings in all.*0 to 0/);
    assert.deepEqual(check([2, 4], [row('A'), row('B')]).errors, [], '4 happenings');
    assert.match(check([2, 4], [row('A'), row('B'), row('C')]).errors.join(' '), /happenings in all/, '5 happenings are refused');
    assert.equal(check([3, 4], []).plan, undefined, 'too few for a 3 to 4 template');
    assert.equal(check([2, 2], []).plan.steps.length, 1, 'only the ending is later');
});

test('ruling 52: the opening happening\'s severity counts for the caps', () => {
    assert.equal(check([2, 3], [], { severity: 'major' }).plan.major, true, 'a major opening makes the arc major');
    assert.equal(check([2, 3], []).plan.major, false);
    const spec = { ...WORLD, templates: [open('arc-t', { arc: { steps: [2, 3] } })] };
    const first = runDays({ world: spec, today: 10, seed: 'seed1', draw: () => 0, state: null });
    const [slot] = first.daily.pending;
    const answer = JSON.stringify({ ...answerFor(slot.key), severity: 'major', arc: { steps: [], ending: row('End') } });
    const done = runDays({ world: spec, today: 10, seed: 'seed1', draw: () => 0, state: first.daily, table: first.conditions, settle: true, opens: { results: { [slot.key]: { outcome: 'ok', answer } } } });
    assert.equal(done.daily.arcs[slot.key].major, true);
    assert.equal(done.daily.lastMajor['March Realm'], 10, 'the realm timer restarts for a major opening');
    const { ws } = makeWs({ state: done.daily, world: spec, today: 20, seed: 'seed1' });
    assert.match(capBlock(ws, ['March Realm'], 20), /less than 45 days/);
});

test('only checked fields are stored: a plan with junk keys is whole JSON and starts its arc; a template with no arc keeps no arc or severity', async () => {
    const junk = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`junk${i}`, 'y'.repeat(300)]));
    const model = fakeModel();
    model.extra = { arc: { steps: [{ ...row('Riot', 1), ...junk }, { ...row('Curfew', 1), ...junk }], ending: { ...row('Calm', 1), ...junk } }, severity: 'minor' };
    const host = await build(model);
    try {
        const rows = Object.entries(ledgerOpen(host).results);
        const arcRow = rows.find(([, entry]) => /Riot/.test(entry.answer));
        assert.ok(arcRow, 'the plan is stored');
        const stored = JSON.parse(arcRow[1].answer);
        assert.equal(JSON.stringify(stored).includes('junk'), false, 'unchecked keys are not stored');
        assert.equal(arcRow[1].outcome, 'ok');
        const plain = rows.find(([key]) => /border-incident/.test(key));
        assert.ok(plain, 'the plain template is stored too');
        const plainAnswer = JSON.parse(plain[1].answer);
        assert.equal('arc' in plainAnswer || 'severity' in plainAnswer, false, 'a template with no arc keeps neither key');
    } finally { host.done(); }
});

test('shapeAnswer keeps the checked fields only and leaves a malformed arc to the check', () => {
    const def = { open: { arc: { steps: [2, 4] } } };
    const shaped = shapeAnswer(def, { ...answerFor('k'), junk: 1, severity: 'major', arc: { steps: [{ ...row('A'), junk: 1 }, 7], ending: { ...row('E'), junk: 2 }, extra: 1 } });
    assert.deepEqual(Object.keys(shaped), ['name', 'summary', 'people', 'effects', 'severity', 'arc']);
    assert.deepEqual(Object.keys(shaped.arc), ['steps', 'ending']);
    assert.equal('junk' in shaped.arc.steps[0], false);
    assert.equal(shaped.arc.steps[1], 7);
    assert.equal(shapeAnswer(def, { ...answerFor('k'), arc: 'no' }).arc, 'no');
    assert.equal('severity' in shapeAnswer({ open: {} }, { ...answerFor('k'), severity: 'major' }), false);
});

test('a cut answer keeps its whole rows; only the cut slot is asked again', () => {
    const full = JSON.stringify({ results: [{ slot: 'a', name: 'One', summary: 's "}" ok', people: [], effects: {} }, { slot: 'b', name: 'Two', summary: 'cut here', people: [], effects: {}, arc: { steps: [] } }] });
    const cut = full.slice(0, full.length - 30);
    assert.throws(() => JSON.parse(cut));
    const read = readOpenAnswer(cut);
    assert.deepEqual(Object.keys(read), ['a'], 'the whole row stays, the cut one is dropped');
    assert.equal(read.a.summary, 's "}" ok', 'braces inside a string do not end a row');
    assert.equal(readOpenAnswer('{"results":[{"slot":"a","na'), null, 'nothing whole: no answer');
    assert.equal(readOpenAnswer(full).b.arc.steps.length, 0);
});

test('the call asks for tokens by the number of arc slots; a plain batch is unchanged', async () => {
    const two = { ...WORLD, templates: [open('border-incident', { arc: { steps: [2, 3] } }), open('night-watch', { arc: { steps: [2, 3] } })] };
    const model = fakeModel();
    const host = await openHost(model, two);
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await settle();
        await host.send('Hours.', said('Hours.', '! time +1h'));
        await settle();
        const first = model.requests[0];
        const slots = (first.prompt.match(/^Arc allowed/gm) ?? []).length;
        assert.ok(slots >= 1);
        assert.equal(first.maxTokens, 1200 + 1200 * slots);
    } finally { host.done(); }
    const plain = fakeModel();
    const hostPlain = await openHost(plain);
    try {
        await hostPlain.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await settle();
        await hostPlain.send('Hours.', said('Hours.', '! time +1h'));
        await settle();
        assert.equal(plain.requests[0].maxTokens, 1200);
    } finally { hostPlain.done(); }
});

test('a timed-out call is asked once more; a second timeout is the fallback', async () => {
    const run = async fails => {
        const model = fakeModel();
        const real = model.callModel.bind(model);
        let timeouts = fails;
        model.callModel = async request => (timeouts-- > 0 ? (model.calls += 1, { ok: false, text: '', error: 'TIMEOUT', message: 'slow' }) : real(request));
        const host = await openHost(model);
        try {
            await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
            await settle();
            await host.send('Hours.', said('Hours.', '! time +1h'));
            await settle();
            await host.send('More.', said('More.', '! time +1h'));
            return { calls: model.calls, results: Object.values(ledgerOpen(host)?.results ?? {}) };
        } finally { host.done(); }
    };
    const once = await run(1);
    assert.equal(once.calls, 2);
    assert.equal(once.results[0].outcome, 'ok');
    const twice = await run(2);
    assert.equal(twice.calls, 2, 'asked once more only');
    assert.equal(twice.results[0].outcome, 'fallback');
});

test('hidden lore titles match whitespace- and case-blind, so a spaced title is never sent', () => {
    const world = { lore: [{ title: '  The  Secret   Vault ', hidden: true, text: 'x' }, { title: 'Open Hall', text: 'y' }] };
    const ask = name => (name === 'director.loreDigest'
        ? { lines: [{ title: 'The Secret Vault' }, { title: 'Open Hall' }] }
        : { entries: [{ title: 'The Secret Vault', text: 'SECRET TEXT' }, { title: 'Open Hall', text: 'fine' }] });
    const text = loreText(ask, [{ place: 'Highmark', region: 'The March', realm: 'March Realm' }], world);
    assert.equal(/Secret|SECRET/.test(text), false);
    assert.match(text, /Open Hall/);
});

test('the ledger keeps its answers within a size: the oldest go first, never one stored now', () => {
    const big = i => ({ outcome: 'ok', answer: `${i}${'z'.repeat(30000)}` });
    const chronicle = {};
    storeOpen(chronicle, { results: { a: big(1), b: big(2), c: big(3) } });
    storeOpen(chronicle, { results: { d: big(4), e: big(5) } });
    const kept = Object.keys(slotValue(chronicle.ledger).open.results);
    assert.deepEqual(kept, ['b', 'c', 'd', 'e'].slice(-4).filter(key => kept.includes(key)));
    assert.ok(kept.includes('d') && kept.includes('e'), 'the newest are kept');
    assert.equal(kept.includes('a'), false, 'the oldest went first');
    const size = Object.values(slotValue(chronicle.ledger).open.results).reduce((sum, item) => sum + JSON.stringify(item).length, 0);
    assert.ok(size <= 120000);
});

test('the prompt shows the arc shape: counting rule, ranges and an example', () => {
    assert.match(ARC_SYSTEM, /every happening in all/);
    assert.match(ARC_SYSTEM, /1 to 90/);
    assert.match(ARC_SYSTEM, /1 to 60/);
    assert.match(ARC_SYSTEM, /"arc":\{"steps":\[\{/);
    assert.equal(arcLine({ steps: [2, 4] }), 'Arc allowed: 2 to 4 happenings in all (the one above, "arc.steps" and "arc.ending"); "arc.steps" lists 0 to 2');
});
