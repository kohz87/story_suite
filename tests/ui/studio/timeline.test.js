// The Dry run page (ST-DRYV): the seed, tempo and days form, Run in a Worker (or in the page), progress, Cancel and a failed run, and the
// result: the summary, the timeline by day with Go to, the condition holds, the power and score curves, and the cast's moves and deaths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderPage } from '../../../studio/views/timeline.js';
import { simulate } from '../../../studio/dryrun/run.js';
import { answer } from '../../../studio/dryrun/worker.js';

const WORLD = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const GAME = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));

// The mini world with an event that is all but sure to fire, a riot template and a score. Each test gets its own id (the page keeps
// its form and last run per pack id).
let made = 0;
function busyWorld() {
    const world = structuredClone(WORLD);
    world.id = `dry-${made += 1}`;
    world.content.realms = [{ name: 'Fen March', regions: ['the-fen'] }];
    world.content.conditions.push({ name: 'unrest', scope: 'place', fades: '10 days' });
    world.content.scores = [{ id: 'calm', name: 'Calm', start: 0 }];
    world.content.worldEvents = [{ id: 'levy', kind: 'one-off', certainty: 'likely', where: ['Fen March'], ends_when: { for: '5 days' }, summary: 'A levy is called in the Fen.', chance: '90% over the window', window: { after: 'start', within: '20 days' } }];
    world.content.templates = [{ template: 'riot', severity: 'minor', where: { kinds: ['lock town', 'marsh'] }, sets: ['unrest@place: 3 days'], chance: '80% per season', summary: 'Riot in {place}.' }];
    return world;
}

function setup({ world = busyWorld(), game = null, worker = undefined } = {}) {
    installFakeDom();
    globalThis.Worker = worker;
    const calls = [];
    const ctx = { doc: world, kind: 'world', legacy: false, other: game, problems: [], focus: null, go: (...args) => { calls.push(args); if (args[0] === 'timeline') draw(); } };
    let page = null;
    function draw() {
        page = document.createElement('div');
        page.append(...renderPage(ctx));
        document.body.replaceChildren(page);
        return page;
    }
    return { ctx, calls, draw, get page() { return page; } };
}
test('the run row names the world\u2019s start date, from content.start', async () => {
    const world = busyWorld();
    world.content.start = { date: { year: 611, month: 10, day: 1 }, world: { set: [], facts: [] } };
    const { draw } = setup({ world });
    draw().querySelector('.st-dry-run').click();
    await settle();
    assert.match(document.body.querySelector('.st-dry-result').textContent, /1 October 611 to \d+ \w+ \d+ · on the built-in calendar\./);
});

const settle = () => new Promise(resolve => setTimeout(resolve, 5));
const field = (page, key) => page.querySelector(`[data-key="${key}"]`);
const texts = (page, selector) => page.querySelectorAll(selector).map(node => node.textContent);

test('before a run: the form (seed from the pack id, tempo 1, 90 days), the calendar it runs on, and nothing run yet', () => {
    const { draw, ctx } = setup();
    const page = draw();
    assert.equal(field(page, 'seed').querySelector('input').value, ctx.doc.id);
    assert.equal(field(page, 'tempo').querySelector('input').value, '1');
    assert.equal(field(page, 'days').querySelector('input').value, '90');
    assert.match(page.querySelector('.st-dry-status').textContent, /Nobody plays: no one is met/);
    assert.ok(page.querySelector('.st-dry-run'));
    assert.match(page.querySelector('.st-dry-none').textContent, /No run yet/);
    const withGame = setup({ game: GAME }).draw();
    assert.match(withGame.querySelector('.st-dry-act').parentNode.textContent, /Dates, months and seasons come from the game pack, Studio game 4 \(test\)/);
});

test('Run (no Worker: in the page) shows Running, then the result, which is the dry run\'s own for the same seed', async () => {
    const { draw, calls, ctx } = setup();
    draw().querySelector('.st-dry-run').click();
    assert.equal(calls.length, 1);
    assert.equal(document.body.querySelector('.st-dry-act').dataset.state, 'running');
    assert.ok(document.body.querySelector('.st-dry-cancel'));
    await settle();
    const page = document.body;
    const expected = simulate({ pack: ctx.doc, seed: ctx.doc.id, tempo: 1, days: 90 });
    const fired = expected.rows.reduce((sum, row) => sum + row.fired.length, 0);
    assert.equal(page.querySelector('.st-dry-act'), null, 'the form folds into the summary line');
    assert.match(page.querySelector('.st-dry-result').textContent, new RegExp(`Seed ${ctx.doc.id} · tempo 1 · 90 days: ${fired} events? fired`));
    assert.match(page.querySelector('.st-dry-result').textContent, /From day 1, since the world gives no start date · on the built-in calendar\./);
    const busy = expected.rows.filter(row => row.journal.length || row.moves.length || row.deaths.length).map(row => String(row.day)).slice(0, 30);
    for (const day of busy) assert.ok(page.querySelector(`.st-day[data-day="${day}"]`), `day ${day} is on the timeline`);
    assert.ok(texts(page, '.st-line').some(text => /A levy is called in the Fen\./.test(text)));
});

test('the same seed gives the same timeline; the form\'s seed, tempo and days are what is run, days within 1 to 3650', async () => {
    const one = setup();
    const world = one.ctx.doc;
    one.draw().querySelector('.st-dry-run').click();
    await settle();
    const first = texts(document.body, '.st-day');
    document.body.querySelector('.st-dry-again').click();
    await settle();
    assert.deepEqual(texts(document.body, '.st-day'), first);

    document.body.querySelector('.st-dry-change').click();
    const page = document.body;
    const seed = field(page, 'seed').querySelector('input');
    seed.value = 'other'; seed.dispatch('change');
    const tempo = field(page, 'tempo').querySelector('input');
    tempo.value = '2'; tempo.dispatch('change');
    const days = field(page, 'days').querySelector('input');
    days.value = '99999'; days.dispatch('change');
    page.querySelector('.st-dry-run').click();
    await settle();
    assert.match(document.body.querySelector('.st-dry-result').textContent, /Seed other · tempo 2 · 3,650 days/);
    document.body.querySelector('.st-dry-change').click();
    const again = document.body;
    assert.equal(field(again, 'days').querySelector('input').value, '3650');
    const low = field(again, 'days').querySelector('input');
    low.value = '0'; low.dispatch('change');
    again.querySelector('.st-dry-run').click();
    await settle();
    assert.match(document.body.querySelector('.st-dry-result').textContent, /^Seed other · tempo 2 · 1 day/);
    assert.equal(one.ctx.doc, world);
});

test('the timeline\'s Go to opens the event and the template; holds and curves are drawn by name', async () => {
    const { draw, calls } = setup();
    const form = draw();
    const seed = field(form, 'seed').querySelector('input');
    seed.value = 'studio-world4-mini'; seed.dispatch('change');
    form.querySelector('.st-dry-run').click();
    await settle();
    const page = document.body;
    page.querySelector('.st-dry-filter[data-filter="events"]').click();
    const kinds = new Set(document.body.querySelectorAll('.st-line').map(line => line.dataset.kind));
    assert.ok(kinds.has('fired') && kinds.has('ended'));
    const fired = document.body.querySelector('.st-line[data-kind="fired"] .st-dry-go');
    fired.click();
    assert.deepEqual(calls.at(-1), ['events', 'worldEvents.0']);
    document.body.querySelector('.st-dry-filter[data-filter="templates"]').click();
    const riot = document.body.querySelector('.st-line[data-kind="happens"] .st-dry-go');
    assert.match(riot.parentNode.textContent, /Riot in Reedmoor\./);
    riot.click();
    assert.deepEqual(calls.at(-1), ['templates', 'templates.0']);
    document.body.querySelector('.st-dtab[data-tab="curves"]').click();
    assert.equal(document.body.querySelectorAll('.st-stand').length, 0, 'nothing moved in this pack, so no plot card');
    assert.match(document.body.querySelector('.st-dry-powers .st-still').textContent, /1 did not move.*The Lamp Guild \(20\)/);
    assert.match(document.body.querySelector('.st-dry-scores .st-still').textContent, /Calm \(0\)/);
    document.body.querySelector('.st-dtab[data-tab="holds"]').click();
    const holds = document.body.querySelectorAll('.st-hold');
    // The world's start (content.start.world) holds lamps-out from day 1; each row is a condition at a place.
    assert.deepEqual(holds.map(hold => hold.dataset.name), ['lamps-out', 'unrest']);
    assert.ok(holds[0].dataset.place, 'a hold names its place');
    assert.match(holds[0].querySelector('small').textContent, /^first /);
    assert.equal(holds[0].querySelector('.st-hdays').textContent.replace(/\d+/, 'N'), 'N days');
    assert.match(holds[1].querySelector('.st-hdays').textContent, /^3 days$/);
    assert.equal(holds[1].querySelector('.st-holdbar span').style.getPropertyValue?.('width') ?? holds[1].querySelector('.st-holdbar span').getAttribute('style'), `${(3 / 90) * 100}%`);
});

test('a condition held in many places has one row per place, each with its runs; By condition merges them; Show all lifts the 15-row cap', async () => {
    const day = (n, held) => ({ day: n, fired: [], journal: [], log: [], warnings: [], moves: [], deaths: [], held: held.map(key => key.split('@')[0]), heldAt: held, standings: {} });
    const places = Array.from({ length: 18 }, (_, at) => `Place ${at + 1}`);
    const rows = Array.from({ length: 10 }, (_, at) => day(at + 1, [...places.map(place => `unrest@${place}`).slice(0, at < 2 || at > 5 ? 18 : 1), 'wet@Fen']));
    const { FakeWorker, made } = fakeWorkerClass({ result: { seed: 's', tempo: 1, days: 10, rows, finalEvents: {}, warnings: [] } });
    const run = setup({ worker: FakeWorker });
    run.draw().querySelector('.st-dry-run').click();
    made[0].tick();
    await settle();
    document.body.querySelector('.st-dtab[data-tab="holds"]').click();
    let holds = document.body.querySelectorAll('.st-hold');
    assert.equal(holds.length, 15, 'the first 15 only');
    assert.equal(holds[1].dataset.place, 'Place 2');
    assert.match(holds[1].querySelector('small').textContent, /2 times: days 1–2, days 7–10/);
    assert.doesNotMatch(document.body.querySelector('.st-dry-holds').textContent, /days \d+–\d+, day \d+, /);
    document.body.querySelector('.st-dry-holdsall').click();
    assert.equal(document.body.querySelectorAll('.st-hold').length, 19);
    document.body.querySelector('.st-dry-holdsby').click();
    holds = document.body.querySelectorAll('.st-hold');
    assert.deepEqual(holds.map(hold => hold.dataset.name), ['unrest', 'wet']);
    assert.match(holds[0].querySelector('small').textContent, /held at 18 places/);
});

test('Curves are plot cards for what moved, the Cast tab has Deaths, Moves, Status changes and As they began, and a day card folds', async () => {
    const day = (n, extra = {}) => ({ day: n, fired: [], journal: [], log: [], warnings: [], moves: [], deaths: [], held: [], statuses: [], standings: {}, ...extra });
    const rows = Array.from({ length: 12 }, (_, at) => day(at + 1, { standings: { 'score:calm': at < 6 ? 0 : 5, 'power:lamp-guild': 20 }, journal: at < 4 ? [{ day: at + 1, text: `News ${at + 1}`, by: 'nobody' }, { day: at + 1, text: `More ${at + 1}`, by: 'nobody' }] : [] }));
    rows[4] = day(5, { standings: rows[4].standings, moves: [{ id: 'wren', to: 'reedmoor', by: 'levy', day: 5 }], statuses: [{ id: 'wren', status: 'hunted' }] });
    rows[9] = day(10, { standings: rows[9].standings, deaths: [{ id: 'old-tam', by: 'levy', day: 10 }] });
    const { FakeWorker, made } = fakeWorkerClass({ result: { seed: 's', tempo: 1, days: 12, rows, finalEvents: {}, warnings: [] } });
    const run = setup({ worker: FakeWorker });
    run.ctx.doc.content.cast = [...run.ctx.doc.content.cast, { id: 'bystander', name: 'Bystander' }];
    run.draw().querySelector('.st-dry-run').click();
    made[0].tick();
    await settle();
    const days = () => document.body.querySelectorAll('.st-day');
    assert.deepEqual(days().map(card => card.dataset.open), ['true', 'true', 'false', 'false', 'false', 'false'], 'the first two open, the rest folded to a line');
    assert.match(days()[2].querySelector('.st-peek').textContent, /News 3/);
    days()[2].querySelector('.st-dayhead').click();
    assert.equal(days()[2].dataset.open, 'true');
    assert.equal(days()[2].querySelectorAll('.st-line').length, 2);
    document.body.querySelector('.st-dtab[data-tab="curves"]').click();
    assert.deepEqual(document.body.querySelectorAll('.st-dry-curves .gt').map(node => node.textContent), ['Scores · 1 · 1 moved', 'Powers · 1 · 0 moved']);
    const plot = document.body.querySelector('.st-plot[data-kind="score"]');
    assert.equal(plot.querySelector('.st-delta').textContent, '0 → 5');
    assert.match(plot.querySelector('small').textContent, /1 change · biggest \+5 on day 7/);
    assert.match(document.body.querySelector('.st-still').textContent, /1 did not move.*The Lamp Guild \(20\)|1 did not move.*lamp-guild \(20\)/);
    document.body.querySelector('.st-dtab[data-tab="cast"]').click();
    assert.deepEqual(document.body.querySelectorAll('.st-dry-cast .gt').map(node => node.textContent.replace(/ ·.*/, '')), ['Deaths', 'Moves', 'Status changes', 'As they began']);
    assert.match(document.body.querySelector('.st-dry-status-changes').textContent, /“hunted”/);
    run.calls.length = 0;
    document.body.querySelector('.st-dry-moves .st-dry-go[data-part="events"], .st-dry-moves .st-dry-go[data-part="cast"]').click();
    assert.equal(run.calls.length, 1);
});

// A fake Worker that answers through the real worker wrapper, or with a set result, or crashes; it never answers until `tick()`.
function fakeWorkerClass({ result = null, crash = false } = {}) {
    const made = [];
    class FakeWorker {
        constructor(url, options) { this.url = String(url); this.options = options; this.terminated = 0; made.push(this); }
        postMessage(input) { this.input = input; }
        terminate() { this.terminated += 1; }
        tick() {
            if (crash) return this.onerror?.({ message: 'boom' });
            if (result) { this.onmessage?.({ data: { progress: 10 } }); return this.onmessage?.({ data: { result } }); }
            return answer(this.input, data => this.onmessage?.({ data }));
        }
    }
    return { FakeWorker, made };
}

test('in a Worker: the worker file, progress written into the page, the result; a crash says why; Cancel stops it', async () => {
    const { FakeWorker, made } = fakeWorkerClass();
    const run = setup({ worker: FakeWorker });
    run.draw().querySelector('.st-dry-run').click();
    assert.match(made[0].url, /studio\/dryrun\/worker\.js$/);
    assert.deepEqual(made[0].options, { type: 'module' });
    assert.equal(made[0].input.days, 90);
    made[0].onmessage({ data: { progress: 40 } });
    assert.equal(document.body.querySelector('.st-dry-status').textContent, 'Day 40 of 90…');
    made[0].tick();
    await settle();
    assert.ok(document.body.querySelector('.st-dry-result'));
    assert.equal(made[0].terminated, 1);

    const broken = fakeWorkerClass({ crash: true });
    setup({ worker: broken.FakeWorker }).draw().querySelector('.st-dry-run').click();
    broken.made[0].tick();
    await settle();
    assert.match(document.body.querySelector('.st-dry-error').textContent, /The dry run stopped\.boom/);

    const stopped = fakeWorkerClass();
    const third = setup({ worker: stopped.FakeWorker });
    third.draw().querySelector('.st-dry-run').click();
    document.body.querySelector('.st-dry-cancel').click();
    await settle();
    assert.equal(stopped.made[0].terminated, 1);
    assert.equal(document.body.querySelector('.st-dry-act').dataset.state, 'idle');
    assert.equal(document.body.querySelector('.st-dry-error'), null, 'a cancel is not an error');
    assert.ok(document.body.querySelector('.st-dry-none'));
});

test('the cast\'s moves and deaths, a long timeline behind Show all, the engine\'s warnings, and a run the pack has changed since', async () => {
    const day = (n, extra = {}) => ({ day: n, fired: [], journal: [], log: [], warnings: [], moves: [], deaths: [], held: [], standings: {}, ...extra });
    const rows = Array.from({ length: 80 }, (_, at) => day(at + 1, { journal: [{ day: at + 1, text: `News ${at + 1}`, by: 'nobody' }] }));
    rows[4] = day(5, { moves: [{ id: 'wren', to: 'reedmoor', by: 'levy', routine: 'staying at reedmoor because a levy', day: 5 }] });
    rows[9] = day(10, { deaths: [{ id: 'old-tam', by: 'levy', day: 10 }] });
    const result = { seed: 's', tempo: 1, days: 80, rows, finalEvents: {}, warnings: ['Tempo 9 is outside 0.25-4; tempo 1 is used.'] };
    const { FakeWorker, made } = fakeWorkerClass({ result });
    const run = setup({ worker: FakeWorker });
    run.draw().querySelector('.st-dry-run').click();
    made[0].tick();
    await settle();
    let page = document.body;
    assert.equal(page.querySelectorAll('.st-day').length, 30);
    page.querySelector('.st-day[data-day="5"] .st-dayhead').click(); // the days past the first two are folded
    page.querySelector('.st-day[data-day="10"] .st-dayhead').click();
    page = document.body;
    assert.match(page.querySelector('.st-day[data-day="5"] .st-line[data-kind="move"]').textContent, /Wren Ashby goes to reedmoor\./);
    assert.match(page.querySelector('.st-day[data-day="10"] .st-line[data-kind="death"]').textContent, /Old Tam dies \(levy\)\./);
    assert.match(page.querySelector('.st-dry-warnhead').textContent, /The engine said 1 thing about the pack/);
    assert.equal(page.querySelector('.st-dry-warn'), null, 'the notes are folded until Show');
    page.querySelector('.st-dry-warnshow').click();
    assert.match(document.body.querySelector('.st-dry-warn').textContent, /Tempo 9 is outside/);
    page = document.body;
    page.querySelector('.st-dry-more').click();
    assert.equal(document.body.querySelectorAll('.st-day').length, 60);
    document.body.querySelector('.st-dry-more').click();
    assert.equal(document.body.querySelectorAll('.st-day').length, 80);
    assert.equal(document.body.querySelector('.st-dry-result').dataset.stale, 'false');
    document.body.querySelector('.st-dtab[data-tab="cast"]').click();
    page = document.body;
    assert.deepEqual(texts(page, '.st-cast b'), ['Old Tam dies', 'Wren Ashby goes to reedmoor: staying at reedmoor because a levy']);
    assert.deepEqual(texts(page, '.st-dry-cast .gt'), ['Deaths · 1', 'Moves · 1']);
    page.querySelector('.st-dry-moves .st-dry-go[data-part="cast"]').click();
    assert.deepEqual(run.calls.at(-1), ['cast', 'cast.0']);
    run.ctx.doc = { ...run.ctx.doc };
    assert.equal(run.draw().querySelector('.st-dry-result').dataset.stale, 'true');
    assert.match(document.body.querySelector('.st-dry-result').textContent, /The pack has changed since/);
});

test('a world that is not JSON draws no page, so the part is not mounted', () => {
    const { ctx } = setup();
    ctx.doc = null;
    assert.deepEqual(renderPage(ctx), []);
});

test('the hold bar has its own class: the editors\u2019 .st-bar (list and record heads) is not styled by the dry-run sheet', () => {
    const sheet = readFileSync(new URL('../../../studio/css/timeline.css', import.meta.url), 'utf8');
    assert.doesNotMatch(sheet, /\.st-bar\b/);
    assert.match(sheet, /\.st-holdbar\b/);
});
