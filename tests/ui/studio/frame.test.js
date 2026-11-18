// The Studio frame against mocks MK-2, MK-6, MK-7 and MK-9: each nav row's count or problems (navBadges), the page line in words
// (partLine), and in Chromium on the shipped Ersveil pair: the Home row, the World / Game switch (both packs open) on desktop and phone,
// the nav counts, the foot bar's red count, the start page with no pack (no nav column, no "‹ Parts", a centred column).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT, serve } from './serve.js';
import { navBadges, partLine } from '../../../studio/nav-counts.js';

const check = (errors = [], warnings = []) => {
    const byPart = {};
    for (const p of [...errors.map(part => ({ part, level: 'error' })), ...warnings.map(part => ({ part, level: 'warning' }))]) (byPart[p.part] ??= []).push(p);
    return { errors: errors.map(part => ({ part })), warnings: warnings.map(part => ({ part })), byPart, total: errors.length + warnings.length };
};
const PARTS = [{ id: 'start' }, { id: 'overview' }, { id: 'lore', kind: 'world', count: 218 }, { id: 'cast', kind: 'world', count: 31 }, { id: 'events', kind: 'world', count: 103 },
    { id: 'calendar', kind: 'game', count: 12 }, { id: 'timeline', kind: 'world', page: 'timeline' }, { id: 'pairing', kind: 'world', page: 'pairing' }, { id: 'problems' }];

test('nav badges: a count, ✕ problems in red, ! warnings, Problems as errors · warnings, Pairing "—" while a pack has problems', () => {
    const world = { name: 'Ersveil', check: check(['lore', 'lore'], ['events']) };
    const game = { name: 'Tidewatch', check: check() };
    const out = navBadges(PARTS, { world, game }, 'world');
    assert.equal(out.start, undefined);
    assert.equal(out.overview, undefined);
    assert.equal(out.timeline, undefined);
    assert.deepEqual(out.lore, { text: '✕ 2', bad: true, title: '2 problems' });
    assert.deepEqual(out.cast, { text: '31', bad: false, title: null });
    assert.deepEqual(out.events, { text: '! 1', bad: false, title: '1 warning' });
    assert.deepEqual(out.calendar, { text: '12', bad: false, title: null });
    assert.deepEqual(out.pairing, { text: '—', bad: false, title: 'Not checked: Ersveil has problems' });
    assert.deepEqual(out.problems, { text: '2 · 1', bad: true, title: '2 problems, 1 warning' });
    const clean = navBadges(PARTS, { world: { check: check() }, game: null }, 'world');
    assert.equal(clean.pairing, undefined);
    assert.deepEqual(clean.problems, { text: '0', bad: false, title: 'No problems' });
    // the game active: Problems counts the game's; an old-format pack is not checked, so it shows counts only
    assert.equal(navBadges(PARTS, { world, game }, 'game').problems.text, '0');
    const old = navBadges(PARTS, { world: { legacy: true, check: check(['lore']) }, game: null }, 'world');
    assert.deepEqual([old.lore.text, old.problems, old.pairing], ['218', undefined, undefined]);
});

test('the page line says what a part holds in words, not content keys', () => {
    const map = { desc: 'Places, routes, regions, realms', sections: [{ key: 'places', count: 320, value: [] }, { key: 'routes', count: 1, value: [] }, { key: 'placeKinds', count: 20, value: {} }, { key: 'realms', count: 0, value: [], absent: true }] };
    assert.equal(partLine(map), 'Places, routes, regions, realms. 320 places · 1 route');
    assert.equal(partLine({ desc: 'Months', sections: [{ key: 'calendar', count: 8, value: {} }] }), 'Months');
    assert.equal(partLine({ desc: 'Name', always: true, sections: [] }), 'Name');
});

let ctx = null;
test.before(async () => {
    try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch();
        const { server, port } = await serve();
        ctx = { browser, server, port };
    } catch (err) {
        if (process.env.CI === 'true') throw err;
        ctx = { skip: `Playwright browser unavailable: ${String(err.message).split('\n')[0]}` };
    }
});
test.after(async () => {
    if (ctx?.browser) await ctx.browser.close();
    if (ctx?.server) await new Promise(done => ctx.server.close(done));
});

async function studio(width, open = true) {
    const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
    await page.waitForSelector('.st-app .st-start');
    if (open) { await page.setInputFiles('.st-file', path.join(ROOT, 'examples/packs/ersveil.zip')); await page.waitForSelector('.st-foot:not([hidden])'); }
    return { page, errors };
}
const box = (page, sel) => page.locator(sel).first().evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, w: r.width, h: r.height, shown: getComputedStyle(el).display !== 'none' && r.width > 0 }; });

test('desktop: Home first, counts at the right of each row, the World / Game switch makes the game active and back', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page, errors } = await studio(1280);
    const nav = await page.$$eval('.snav .si3', rows => rows.map(row => [row.dataset.part, row.querySelector('em')?.textContent ?? '']));
    assert.deepEqual(nav[0], ['start', '']);
    assert.deepEqual(nav.find(([id]) => id === 'cast'), ['cast', '31']);
    assert.deepEqual(nav.find(([id]) => id === 'problems'), ['problems', '0']);
    const row = await box(page, '.snav .si3[data-part="cast"]'), em = await box(page, '.snav .si3[data-part="cast"] em');
    assert.ok(row.right - em.right < 16, 'the count sits at the right edge');
    assert.equal(await page.getAttribute('.snav .psrch', 'placeholder'), 'Search both packs…');
    const sw = await page.$$eval('.pswitch button', buttons => buttons.map(b => [b.dataset.kind, b.getAttribute('aria-pressed'), b.textContent]));
    assert.deepEqual(sw.map(([kind, on]) => [kind, on]), [['world', 'true'], ['game', 'false']]);
    assert.match(sw[0][2], /^WorldErsveil/);
    await page.click('.pswitch button[data-kind="game"]');
    assert.match(await page.textContent('.shd .ttl small'), /^Game · /);
    assert.equal(await page.getAttribute('.pswitch button[data-kind="game"]', 'aria-pressed'), 'true');
    assert.equal(await page.textContent('.spage h2'), 'Overview');
    await page.click('.pswitch button[data-kind="world"]');
    assert.match(await page.textContent('.shd .ttl small'), /^World · /);
    await page.click('.snav .si3[data-part="start"]');
    assert.equal(await page.textContent('.spage h2'), 'Open or start a pack');
    assert.equal(await page.getAttribute('.snav .si3[data-part="start"]', 'aria-current'), 'true');
    assert.ok((await box(page, '.spage')).w <= 760);
    await page.click('.snav .si3[data-part="map"]');
    assert.match(await page.textContent('.spage .sdesc'), /\d+ places · \d+ routes/);
    assert.doesNotMatch(await page.textContent('.spage .sdesc'), /placeKinds|worldEvents/);
    assert.deepEqual(errors, []);
    await page.close();
});

test('phone: the switch is a row of two halves under the title; no pack open shows no "‹ Parts" and no nav column', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    let { page, errors } = await studio(390);
    const sw = await box(page, '.pswitch'), title = await box(page, '.shd .ttl'), acts = await box(page, '.st-acts');
    assert.ok(sw.top >= title.top + title.h - 1 && sw.top + sw.h <= acts.top + 1, 'between the title and the buttons');
    const halves = await page.$$eval('.pswitch button', buttons => buttons.map(b => Math.round(b.getBoundingClientRect().height)));
    assert.deepEqual(halves, [44, 44]);
    assert.ok(Math.abs(sw.w - 358) < 30, `the switch runs the width (${sw.w})`);
    assert.deepEqual(errors, []);
    await page.close();
    ({ page, errors } = await studio(390, false));
    assert.equal((await box(page, '.sback')).shown, false, 'no "‹ Parts" with no pack open');
    await page.close();
    ({ page, errors } = await studio(1280, false));
    assert.equal((await box(page, '.snav')).shown, false, 'no empty nav column');
    const spage = await box(page, '.spage');
    assert.ok(spage.w <= 760 && Math.abs(spage.left + spage.w / 2 - 640) < 24, 'a centred column');
    assert.equal(await page.textContent('.spage h2'), 'Open or start a pack');
    assert.deepEqual(errors, []);
    await page.close();
});
