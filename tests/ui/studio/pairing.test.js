// The Pairing page (ST-PAIRV, mock MK-6): the world against the open game pack or the Built-in game, the pair's problems, warnings and
// notes with Go to into either pack, the "waits for" state while a pack has problems, Open a game pack, and a format 3 world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderPage } from '../../../studio/views/pairing.js';

const read = name => JSON.parse(readFileSync(new URL(`../../packs/studio/fixtures/${name}`, import.meta.url), 'utf8'));
const WORLD = read('world4-mini.json');
const GAME = read('game4-mini.json');

// A world and a game that do not fit: a start in month 10 and a day 31 event on a 4-month, 30-day calendar, a birthday on day 40, and
// a name list for a region the world does not have.
function misfit() {
    const world = structuredClone(WORLD);
    const game = structuredClone(GAME);
    world.content.start.date = { year: 611, month: 10, day: 1 };
    world.content.worldEvents = [{ id: 'south-deadlock', on: 'date:612-2-31', title: 'The south locks', ends_when: 'instant' }];
    world.content.cast[0].birthday = 'Thaw 40';
    game.content.names.south = { regions: ['Saltreach'], given: ['Ana'] };
    return { world, game };
}

function setup({ world = WORLD, game = null, legacy = false, opened = { ok: true } } = {}) {
    installFakeDom();
    const calls = { go: [], openDoc: [] };
    const keeps = {};
    const ctx = { doc: world, kind: 'world', legacy, other: game, problems: [], focus: null,
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), openDoc: doc => { calls.openDoc.push(doc); return opened; } };
    const draw = () => {
        const root = document.createElement('div');
        root.append(...renderPage(ctx));
        return root;
    };
    return { calls, keeps, draw };
}
const links = node => node.querySelectorAll('.st-pair-go button').map(button => button.textContent);

test('no game open: the world is checked against the Built-in game, which it fits, and its suggested game is a note', () => {
    const { calls, draw } = setup();
    const page = draw();
    const choices = page.querySelectorAll('.st-pair-against .sseg2 button');
    assert.deepEqual(choices.map(button => [button.textContent, button.getAttribute('aria-pressed')]), [['Built-in game', 'true']]);
    assert.match(page.querySelector('.st-pair-against small').textContent, /No game pack is open/);
    assert.ok(page.querySelector('.st-pair-open'));
    const result = page.querySelector('.st-pair-result');
    assert.equal(result.dataset.state, 'fits');
    assert.match(result.textContent, /Studio world 4 \(test\) fits the Built-in game: nothing is switched off\./);
    assert.match(result.textContent, /12 months, January to December/);
    const notes = page.querySelectorAll('.st-pair-list');
    assert.deepEqual(notes.map(group => group.querySelector('.gt').textContent), ['Notes · 1']);
    const note = notes[0].querySelector('.st-pair');
    assert.match(note.textContent, /Studio world 4 \(test\) suggests the game pack studio-game4-mini\./);
    assert.match(note.textContent, /version \^0\.1/);
    assert.deepEqual(links(note), ['Studio world 4 (test): overview ›']);
    note.querySelector('.st-pair-go button').click();
    assert.deepEqual(calls.go, [['overview', null, null]]);
});

test('the open game is checked by default, and a pair that fits says so with no lists', () => {
    const { draw } = setup({ game: GAME });
    const page = draw();
    const choices = page.querySelectorAll('.st-pair-against .sseg2 button');
    assert.deepEqual(choices.map(button => [button.textContent, button.getAttribute('aria-pressed')]), [['Studio game 4 (test) · 0.1.0', 'true'], ['Built-in game', 'false']]);
    assert.equal(page.querySelector('.st-pair-open'), null);
    assert.match(page.querySelector('.st-pair-result').textContent, /fits Studio game 4 \(test\): nothing is switched off/);
    assert.equal(page.querySelectorAll('.st-pair-list').length, 0);
});

test('a pair that does not fit lists its problems and warnings, with Go to into the world and into the game', () => {
    const { world, game } = misfit();
    const { calls, draw } = setup({ world, game });
    const page = draw();
    const result = page.querySelector('.st-pair-result');
    assert.equal(result.dataset.state, 'found');
    assert.match(result.textContent, /Studio world 4 \(test\) with Studio game 4 \(test\): 2 problems · 2 warnings/);
    assert.match(result.textContent, /don’t stop Export/);
    assert.deepEqual(result.querySelectorAll('.st-count').map(span => span.dataset.level), ['error', 'warning']);
    const groups = page.querySelectorAll('.st-pair-list');
    assert.deepEqual(groups.map(group => group.querySelector('.gt').textContent), ['Problems · 2 · switched off in this pair', 'Warnings · 2']);
    const rows = page.querySelectorAll('.st-pair');
    assert.deepEqual(rows.map(node => node.dataset.code), ['PAIR_START_DATE', 'PAIR_EVENT_DATE', 'PAIR_BIRTHDAY', 'PAIR_CULTURE']);
    assert.match(rows[0].querySelector('b').textContent, /The start date is not on this calendar\./);
    assert.match(rows[0].querySelector('small').textContent, /has 4 months, not 10/);
    assert.match(rows[1].querySelector('b').textContent, /Event south-deadlock never fires\./);
    assert.match(rows[2].querySelector('b').textContent, /Wren Ashby’s birthday is dropped\./);
    assert.match(rows[3].querySelector('b').textContent, /Name list south is unused\./);
    assert.deepEqual(links(rows[0]), ['Studio world 4 (test): start date ›', 'Studio game 4 (test): calendar ›']);
    assert.deepEqual(links(rows[3]), ['Studio game 4 (test): names ›', 'Studio world 4 (test): regions ›']);
    for (const node of rows) for (const button of node.querySelectorAll('.st-pair-go button')) button.click();
    assert.deepEqual(calls.go, [
        ['conditions', null, null], ['calendar', null, null],
        ['events', 'worldEvents.0', ['on']], ['calendar', null, null],
        ['cast', 'cast.0', ['birthday']], ['calendar', null, null],
        ['names', null, null], ['map', null, null],
    ]);
});

test('Check against the Built-in game is kept for the page and redraws it; the game pack is then not looked at', () => {
    const { world, game } = misfit();
    const { calls, keeps, draw } = setup({ world, game });
    draw().querySelector('[data-against="built-in"]').click();
    assert.equal(keeps.pairing.builtIn, true);
    assert.deepEqual(calls.go, [['pairing']]);
    const page = draw();
    assert.equal(page.querySelector('[data-against="built-in"]').getAttribute('aria-pressed'), 'true');
    assert.match(page.querySelector('.st-pair-result').textContent, /with the Built-in game: 1 problem · 1 warning · 1 note/);
    assert.deepEqual(page.querySelectorAll('.st-pair').map(node => node.dataset.code), ['PAIR_EVENT_DATE', 'PAIR_BIRTHDAY', 'PAIR_RECOMMENDS']);
    assert.deepEqual(links(page.querySelector('.st-pair')), ['Studio world 4 (test): the event ›'], 'no Go to into a game that is not checked');
    page.querySelector('[data-against="game"]').click();
    assert.equal(keeps.pairing.builtIn, false);
});

test('a pack with problems holds the pair back, names it, and Go to opens that pack\'s Problems', () => {
    const world = { ...structuredClone(WORLD), version: 7 };
    const { calls, draw } = setup({ world, game: GAME });
    const page = draw();
    const result = page.querySelector('.st-pair-result');
    assert.equal(result.dataset.state, 'blocked');
    assert.match(result.querySelector('b').textContent, /Pairing waits for the world: Studio world 4 \(test\) has \d+ problems?\./);
    assert.match(result.querySelector('small').textContent, /once both packs pass their own check\. Studio game 4 \(test\) passes\./);
    assert.equal(page.querySelectorAll('.st-pair-list').length, 0);
    result.querySelector('.st-pair-go button').click();
    assert.deepEqual(calls.go, [['lore'], ['problems']]);

    const blockedGame = setup({ game: { ...structuredClone(GAME), version: 7 } });
    const gamePage = blockedGame.draw();
    assert.match(gamePage.querySelector('.st-pair-result b').textContent, /Pairing waits for the game: Studio game 4 \(test\) has/);
    gamePage.querySelector('.st-pair-result .st-pair-go button').click();
    assert.deepEqual(blockedGame.calls.go, [['calendar'], ['problems']]);
});

test('Open a game pack opens the picked pack.json beside the world and shows Pairing; a refusal is said on the page', async () => {
    const { calls, draw } = setup();
    const page = draw();
    const input = page.querySelector('input.st-pair-file');
    assert.equal(input.getAttribute('type'), 'file');
    input.files = [{ name: 'game.json', text: async () => JSON.stringify(GAME) }];
    input.dispatch('change');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(calls.openDoc, [{ text: JSON.stringify(GAME), name: 'game.json' }]);
    assert.deepEqual(calls.go, [['pairing']]);

    const refused = setup({ opened: { ok: false, refusal: 'That is not a pack to open.' } });
    const again = refused.draw().querySelector('input.st-pair-file');
    again.files = [{ name: 'x.json', text: async () => 'x' }];
    again.dispatch('change');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(refused.draw().querySelector('.st-pair-note').textContent, /Not opened.*That is not a pack to open\./);
});

test('a format 3 world is not paired: the page says to convert it, with Go to Overview', () => {
    const { calls, draw } = setup({ world: { id: 'old', name: 'Old world', format: 3, content: {} }, legacy: true });
    const page = draw();
    assert.equal(page.querySelector('.st-pair-result').dataset.state, 'legacy');
    assert.match(page.textContent, /Pairing needs a format 4 world\./);
    assert.equal(page.querySelector('.st-pair-against'), null);
    page.querySelector('.st-pair-go button').click();
    assert.deepEqual(calls.go, [['overview', null, null]]);
});
