// The blocks built from the building blocks (UI stage 1b): ss.hero, ss.tiers, ss.listcard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hero, heroBars, heroLevel, heroLine, heroPicture } from '../../../../ui/legacy/view/widgets/hero.js';
import { tiers, tierList } from '../../../../ui/legacy/view/widgets/tiers.js';
import { listcard, listRows } from '../../../../ui/legacy/view/widgets/listcard.js';
import { tabs, navbar } from '../../../../ui/legacy/view/widgets/nav.js';
import { dialog } from '../../../../ui/legacy/view/widgets/dialog.js';
import { standardWidgets } from '../../../../ui/legacy/view/widgets/index.js';
import { fakeApi } from './fake-dom.js';
import { PNG, classes, mount } from './blocks.helpers.js';

test('the six are standard widgets by their ss. names', () => {
    for (const [name, widget] of [['ss.hero', hero], ['ss.tiers', tiers], ['ss.listcard', listcard], ['ss.tabs', tabs], ['ss.navbar', navbar], ['ss.dialog', dialog]]) assert.equal(standardWidgets[name], widget, name);
});

// ---- hero --------------------------------------------------------------------------------------------

const HERO = {
    name: 'Astra', portrait: PNG, className: 'Soul Class II', level: '12', title: 'Wayfarer', place: 'North Cut', time: '07:20', weather: 'Drizzle',
    bars: [{ kind: 'hp', label: 'HP', value: 50, max: 82 }, { kind: 'mp', label: 'MP', value: 32, max: 40 }, { kind: 'sp', label: 'SP', value: 30, max: 34 }, { kind: 'exp', label: 'Soul growth', value: 640, max: 1000 }],
    statuses: [{ id: 'bleed', label: 'Bleeding', icon: 'fa-droplet', left: 40, unit: 'minutes', tone: 'bad' }, { label: 'Blessed', left: null }],
};

test('hero: name, the class · title line, the level badge, HP/MP/SP bars and the experience word, corner, badges', () => {
    const m = mount(hero, HERO);
    assert.ok(classes(m.root).includes('ss-hero') && classes(m.root).includes('ss-glass'));
    assert.equal(m.root.getAttribute('aria-label'), 'Character: Astra');
    assert.equal(m.el.querySelector('.ss-hero-name').textContent, 'Astra');
    assert.equal(m.el.querySelector('.ss-hero-pill').textContent, 'Soul Class II · Wayfarer');
    assert.ok(!classes(m.el.querySelector('.ss-hero-pill')).includes('ss-pill'), 'the line is plain text, not a pill');
    const badge = m.el.querySelector('.ss-hero-level');
    assert.ok(classes(badge.parentNode).includes('ss-hero-face'), 'the badge lives in the portrait\'s cell');
    assert.ok(classes(m.el.querySelector('.ss-hero-portrait').parentNode).includes('ss-hero-face'));
    assert.equal(badge.hidden, false);
    assert.equal(badge.querySelector('.ss-hero-level-number').textContent, '12');
    assert.equal(badge.querySelector('.ss-hero-level-number').getAttribute('aria-hidden'), 'true');
    assert.equal(badge.querySelector('.ss-visually-hidden').textContent, 'Lv 12');
    assert.equal(badge.querySelector('svg').getAttribute('data-icon'), 'ph-star');
    assert.equal(badge.querySelector('svg').getAttribute('data-weight'), 'fill');
    const pools = m.el.querySelector('.ss-hero-pools');
    assert.deepEqual(pools.querySelectorAll('.ss-bar').map(node => classes(node).find(c => /^ss-bar-/.test(c))), ['ss-bar-hp', 'ss-bar-mp', 'ss-bar-sp']);
    const exp = m.el.querySelector('.ss-hero-exp');
    assert.equal(exp.querySelector('.ss-bar-label').textContent, 'Soul growth', 'the Terms word, as given');
    assert.ok(classes(exp.querySelector('.ss-bar')).includes('ss-bar-exp'));
    assert.equal(exp.querySelector('.ss-bar').getAttribute('aria-valuetext'), '640 / 1000');
    assert.deepEqual(m.el.querySelectorAll('.ss-hero-corner-item').map(node => node.getAttribute('data-kind')), ['time', 'place', 'weather']);
    assert.deepEqual(m.el.querySelectorAll('.ss-hero-corner-text').map(node => node.textContent), ['07:20', 'North Cut', 'Drizzle']);
    assert.equal(m.el.querySelectorAll('.ss-status').length, 2);
    assert.equal(m.el.querySelector('.ss-status').getAttribute('aria-label'), 'Bleeding, 40 minutes left');
    assert.ok(!classes(m.root).includes('ss-hero-compact'));
    // Compact: the same card in a one-row variant; no api command is ever run (read-only).
    m.handle.update({ ...HERO, compact: true });
    assert.ok(classes(m.root).includes('ss-hero-compact'));
    assert.equal(m.el.children.length, 1);
    assert.equal(m.api.commands.length, 0);
    // Nothing given: no pill, no corner, no bars; the root says "Character".
    m.handle.update({});
    assert.equal(m.root.getAttribute('aria-label'), 'Character');
    assert.ok(m.el.querySelector('.ss-hero-pill').hidden && m.el.querySelector('.ss-hero-corner').hidden && m.el.querySelector('.ss-hero-vitals').hidden && m.el.querySelector('.ss-hero-statuses').hidden);
    assert.equal(m.el.querySelectorAll('.ss-bar').length, 0);
});

test('heroLine, heroLevel and heroBars: the line under the name, the badge, at most six bars', () => {
    assert.equal(heroLine({ line: 'Wayfarer of the Lowmere' }), 'Wayfarer of the Lowmere');
    assert.equal(heroLine({ className: 'Mage', level: '3' }), 'Mage', 'the level is the badge, not the line');
    assert.equal(heroLine({ className: 'Mage', title: 'Wayfarer' }), 'Mage · Wayfarer');
    assert.deepEqual(heroLevel({ level: 'Lv 7' }), { number: '7', label: 'Lv 7' });
    assert.deepEqual(heroLevel({ level: '3' }), { number: '3', label: 'Lv 3' });
    assert.deepEqual(heroLevel({ level: 'Rank 12' }), { number: '12', label: 'Rank 12' });
    assert.deepEqual(heroLevel({ level: 'Elder' }), { number: 'Elder', label: 'Elder' });
    assert.deepEqual(heroLevel({}), { number: '', label: '' });
    const ancients = heroLevel({ level: 'Level of the Ancients 73' });
    assert.deepEqual(ancients, { number: '73', label: 'Level of the Ancients 73' }, 'a long level keeps its number and its whole label');
    const nines = heroLevel({ level: '9'.repeat(70) });
    assert.ok(nines.number.length <= 8, 'the badge text is short');
    assert.ok(nines.label.length > 40 && nines.label.startsWith('Lv 999'), 'the label keeps the level, not a 12-character cut');
    assert.equal(heroLine({ title: 'Wayfarer' }), 'Wayfarer');
    assert.equal(heroLine({}), '');
    assert.equal(heroBars(Array.from({ length: 9 }, () => ({ kind: 'hp', label: 'x' }))).length, 6);
    assert.deepEqual(heroBars([null, 3, { label: 'a', value: 1, max: 2 }]).map(b => b.label), ['a']);
});

test('fight header More opens the full hero and resets when leaving the Fight screen', () => {
    const m = mount(hero, { ...HERO, compact: true, boardExpandable: true });
    const more = m.el.querySelector('.ss-hero-board-more');
    assert.equal(more.hidden, false);
    assert.equal(more.getAttribute('aria-expanded'), 'false');
    assert.ok(m.root.classList.contains('ss-hero-compact'));
    more.click();
    assert.equal(more.getAttribute('aria-expanded'), 'true');
    assert.equal(more.textContent, 'Less');
    assert.ok(!m.root.classList.contains('ss-hero-compact'));
    assert.ok(m.root.classList.contains('ss-hero-board-expanded'));
    m.handle.update({ ...HERO, compact: true, boardExpandable: true });
    assert.ok(!m.root.classList.contains('ss-hero-compact'), 'redraw keeps the full card open');
    more.click();
    assert.ok(m.root.classList.contains('ss-hero-compact'));
    more.click();
    m.handle.update({ ...HERO, compact: true });
    assert.equal(more.hidden, true);
    assert.equal(m.el.querySelector('.ss-hero-board-more'), null);
    assert.equal(more.getAttribute('aria-expanded'), 'false');
    assert.ok(m.root.classList.contains('ss-hero-compact'));
});

test('hero portrait: a safe picture, else the initial; a picture that fails to load goes back to the initial', () => {
    const m = mount(hero, { name: 'Ren Avel', portrait: 'https://example.com/ren.png' });
    const img = m.el.querySelector('.ss-hero-img');
    const initial = m.el.querySelector('.ss-hero-initial');
    assert.equal(img.getAttribute('src'), 'https://example.com/ren.png');
    assert.ok(!img.hidden && initial.hidden);
    assert.equal(initial.textContent, 'RA');
    assert.equal(m.el.querySelector('.ss-hero-portrait').getAttribute('aria-label'), 'Portrait of Ren Avel');
    img.dispatch('error');
    assert.ok(img.hidden && !initial.hidden);
    assert.ok(classes(m.el.querySelector('.ss-hero-portrait')).includes('ss-hero-fallback'));
    m.handle.update({ name: 'Ren Avel', portrait: 'https://example.com/ren.png' });
    assert.ok(img.hidden, 'the URL that failed is not tried again');
    m.handle.update({ name: 'Ren Avel', portrait: 'javascript:alert(1)' });
    assert.ok(img.hidden && !img.getAttribute('src'));
    m.handle.update({ name: 'Ren Avel', portrait: '/User Avatars/ren.png' });
    assert.equal(img.getAttribute('src'), '/User Avatars/ren.png');
    assert.ok(!img.hidden && initial.hidden);
});

test('hero portrait from a query (Delta\'s npc.portrait): asked first, checked like any URL, the card\'s picture after it', () => {
    const calls = [];
    const api = { ...fakeApi(), query: (name, args) => { calls.push([name, args]); return 'https://example.com/mira.png'; } };
    const m = mount(hero, { name: 'Mira', portrait: PNG, portraitQuery: 'npc.portrait', portraitArgs: { name: 'Mira' } }, api);
    assert.deepEqual(calls, [['npc.portrait', { name: 'Mira' }]]);
    assert.equal(m.el.querySelector('.ss-hero-img').getAttribute('src'), 'https://example.com/mira.png');
    // An answer that is not a safe picture (or null): the card's own picture, then the initial.
    assert.equal(heroPicture({ portrait: PNG, portraitQuery: 'npc.portrait' }, { query: () => 'javascript:alert(1)' }), PNG);
    assert.equal(heroPicture({ portrait: '', portraitQuery: 'npc.portrait' }, { query: () => null }), '');
    assert.equal(heroPicture({ portrait: PNG, portraitQuery: 'npc.portrait' }, { query: () => { throw new Error('no'); } }), PNG, 'a query that throws is not the reader\'s problem');
    assert.equal(heroPicture({ portraitQuery: 'npc.portrait' }, { query: () => ({ url: PNG }) }), PNG, 'an answer { url }');
    // A name that does not look like a query is never asked; no query function: the picture.
    let asked = 0;
    for (const bad of ['<img src=x onerror=1>', 'a b', '../x', '', 'x'.repeat(300), 'Npc.portrait', 'npc..portrait']) {
        assert.equal(heroPicture({ portrait: PNG, portraitQuery: bad }, { query: () => { asked += 1; return 'https://example.com/x.png'; } }), PNG, bad);
    }
    assert.equal(asked, 0);
    assert.equal(heroPicture({ portrait: PNG, portraitQuery: 'npc.portrait' }, {}), PNG);
});

// ---- tiers -------------------------------------------------------------------------------------------

const TIERS = {
    tiers: [
        { title: 'Basic', tiles: [{ id: 'moon', label: 'Moonlight Slash', icon: 'fa-wand-sparkles', count: '3', hint: 'Lv 3' }, { id: 'blade', label: 'Blade Soul', count: '2' }] },
        { title: 'Advanced', tiles: [{ id: 'frost', label: 'Frost Hex', state: 'ready' }, { id: 'death', label: 'Death Soul', state: 'locked' }] },
        { title: 'Finisher', tiles: [{ id: 'phantom', label: 'Phantom Flash' }] },
    ],
};

test('tiers: a label and a glass grid of tiles per tier, a connector between tiers, the columns set on the grid', () => {
    const m = mount(tiers, { ...TIERS, columns: 2, label: 'Skills' });
    assert.ok(classes(m.root).includes('ss-tiers'));
    assert.equal(m.root.getAttribute('aria-label'), 'Skills');
    assert.deepEqual(m.el.querySelectorAll('.ss-tiers-label').map(node => node.textContent), ['Basic', 'Advanced', 'Finisher']);
    assert.equal(m.el.querySelectorAll('.ss-tiers-link').length, 2, 'one fewer than the tiers');
    assert.equal(m.el.querySelectorAll('.ss-tiers-dot').length, 2);
    assert.equal(m.el.querySelectorAll('.ss-tiers-line').length, 2);
    const grids = m.el.querySelectorAll('.ss-tiers-grid');
    assert.equal(grids.length, 3);
    assert.ok(classes(grids[0]).includes('ss-glass'));
    assert.equal(grids[0].style.getPropertyValue('--ss-cols'), '2');
    assert.equal(m.el.querySelectorAll('.ss-tile').length, 5);
    assert.equal(m.el.querySelectorAll('.ss-tiers-tier')[1].getAttribute('aria-label'), 'Advanced');
    // Columns are 1–6; anything else falls back or is clamped.
    m.handle.update({ ...TIERS, columns: 99 });
    assert.equal(m.el.querySelector('.ss-tiers-grid').style.getPropertyValue('--ss-cols'), '6');
    m.handle.update({ ...TIERS, columns: 'x' });
    assert.equal(m.el.querySelector('.ss-tiers-grid').style.getPropertyValue('--ss-cols'), '3');
    // Without onSelect the tiles are not buttons.
    assert.equal(m.el.querySelectorAll('button').length, 0);
});

test('tiers with onSelect: a tile is a button running { tiers: id }, shown chosen at once; a locked one is not a button; the screen\'s `selected` wins', () => {
    const m = mount(tiers, { ...TIERS, selected: 'frost', onSelect: 'party.pickSkill' });
    const buttons = m.el.querySelectorAll('button');
    assert.equal(buttons.length, 4, 'the locked tile is a group');
    const pressed = () => m.el.querySelectorAll('button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.getAttribute('aria-label'));
    assert.deepEqual(pressed(), ['Frost Hex, ready']);
    const first = buttons[0];
    first.click();
    assert.deepEqual(m.api.commands, [{ type: 'party.pickSkill', payload: { tiers: 'moon' } }]);
    assert.deepEqual(pressed(), ['Moonlight Slash, Lv 3']);
    assert.equal(m.el.querySelectorAll('button')[0], first, 'updated in place: the same button, so the focus stays');
    // A redraw with the same selection keeps the reader's choice; another selection wins.
    m.handle.update({ ...TIERS, selected: 'frost', onSelect: 'party.pickSkill' });
    assert.deepEqual(pressed(), ['Moonlight Slash, Lv 3']);
    m.handle.update({ ...TIERS, selected: 'phantom', onSelect: 'party.pickSkill' });
    assert.deepEqual(pressed(), ['Phantom Flash']);
    // Another shape: drawn again, with no doubled root.
    m.handle.update({ tiers: [{ title: 'Only', tiles: [{ id: 'a', label: 'A' }] }], onSelect: 'party.pickSkill' });
    assert.equal(m.el.children.length, 1);
    assert.equal(m.el.querySelectorAll('.ss-tile').length, 1);
    assert.equal(m.el.querySelectorAll('.ss-tiers-link').length, 0);
    // Without an api the choice still shows and nothing throws.
    const bare = mount(tiers, { ...TIERS, onSelect: 'x.y' }, undefined);
    bare.el.querySelectorAll('button')[1].click();
});

test('tierList: caps and junk', () => {
    assert.equal(tierList(Array.from({ length: 20 }, () => ({ title: 't', tiles: [] }))).length, 12);
    assert.equal(tierList([{ tiles: Array.from({ length: 40 }, (_, i) => ({ id: `i${i}`, label: 'x' })) }])[0].tiles.length, 24);
    assert.deepEqual(tierList([null, 5, { title: 'a', tiles: [null, {}, { label: 'ok' }] }]).map(t => t.tiles.map(x => x.id)), [['ok']]);
    assert.deepEqual(tierList('nope'), []);
});

// ---- listcard ----------------------------------------------------------------------------------------

const ROWS = {
    title: 'Ready to turn in',
    rows: [{ id: 'wolf', title: 'The North Cut Wolf', sub: 'to Elula · here', value: '4 silver' }, { id: 'kroll', title: 'Master Kroll', tag: 'new', tone: 'good', icon: 'fa-user' }, {}, { id: 'x' }],
};

test('listcard: a glass card of rows with title, sub, a value or a tag in a tone; empty rows left out', () => {
    const m = mount(listcard, ROWS);
    assert.ok(classes(m.root).includes('ss-listcard') && classes(m.root).includes('ss-glass'));
    assert.equal(m.root.tagName, 'SECTION');
    assert.equal(m.root.getAttribute('aria-label'), 'Ready to turn in');
    assert.equal(m.el.querySelector('.ss-listcard-head').textContent, 'Ready to turn in');
    assert.equal(m.el.querySelectorAll('.ss-listcard-row').length, 2);
    assert.deepEqual(m.el.querySelectorAll('.ss-listcard-title').map(node => node.textContent), ['The North Cut Wolf', 'Master Kroll']);
    assert.equal(m.el.querySelector('.ss-listcard-sub').textContent, 'to Elula · here');
    assert.equal(m.el.querySelector('.ss-listcard-value').textContent, '4 silver');
    const tag = m.el.querySelector('.ss-listcard-tag');
    assert.equal(tag.textContent, 'new');
    assert.ok(classes(tag).includes('ss-tone-good'));
    assert.ok(m.el.querySelector('i.fa-user'));
    assert.equal(m.el.querySelectorAll('button').length, 0, 'no onSelect: no buttons');
    m.handle.update({ rows: [{ title: 'a', tag: 'x', tone: 'neon' }] });
    assert.ok(!classes(m.el.querySelector('.ss-listcard-tag')).some(c => c.startsWith('ss-tone-')), 'an unknown tone: none');
    assert.ok(m.el.querySelector('.ss-listcard-head').hidden);
    assert.equal(m.root.getAttribute('aria-label'), null);
    m.handle.update({ rows: [], empty: 'Nothing is ready.' });
    assert.equal(m.el.querySelector('.ss-listcard-empty').textContent, 'Nothing is ready.');
    assert.ok(m.el.querySelector('.ss-listcard-rows').hidden && !m.el.querySelector('.ss-listcard-empty').hidden);
});

test('listcard with onSelect: each row a button running { listcard: id }; the chosen row is aria-current; the screen\'s `selected` wins', () => {
    const m = mount(listcard, { ...ROWS, selected: 'kroll', onSelect: 'quests.open' });
    const buttons = () => m.el.querySelectorAll('button');
    assert.equal(buttons().length, 2);
    assert.deepEqual(buttons().map(b => b.getAttribute('aria-current')), [null, 'true']);
    buttons()[0].click();
    assert.deepEqual(m.api.commands, [{ type: 'quests.open', payload: { listcard: 'wolf' } }]);
    assert.deepEqual(buttons().map(b => b.getAttribute('aria-current')), ['true', null]);
    // Focus stays on the row through a redraw.
    buttons()[0].focus();
    m.handle.update({ ...ROWS, selected: 'kroll', onSelect: 'quests.open' });
    assert.equal(m.doc.activeElement, buttons()[0]);
    assert.deepEqual(buttons().map(b => b.getAttribute('aria-current')), ['true', null], 'the same selection prop: the reader\'s choice stays');
    m.handle.update({ ...ROWS, selected: 'wolf', onSelect: 'quests.open' });
    m.handle.update({ ...ROWS, selected: 'kroll', onSelect: 'quests.open' });
    assert.deepEqual(buttons().map(b => b.getAttribute('aria-current')), [null, 'true']);
    assert.deepEqual(listRows(Array.from({ length: 150 }, (_, i) => ({ title: `r${i}` }))).length, 100);
    assert.equal(listRows([{ title: 'a'.repeat(300) }])[0].title.length, 80);
});
