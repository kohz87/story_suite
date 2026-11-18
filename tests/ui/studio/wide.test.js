// The wide layout (ST-WIDE, mock MK-2) with the real editors, on the shipped Ersveil pair: every record part shows nav | list | record at
// 1280 px and wider, each side scrolling on its own, the "No <noun> open" pane while nothing is open, the open record's row marked, and
// the list left where it was when a record opens or the record is edited; Places & routes joins its places, routes and regions into one
// list beside one record. Below 1280 one side shows at a time. Go to scrolls only its own box (C22): the nav and its search stay put.
// Rendered in Chromium; the shell's joining is also checked alone on the fake DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT, serve } from './serve.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createShell } from '../../../studio/shell.js';
import { fitPanes } from '../../../studio/wide.js';

// part → the row to open and the noun of its empty pane (Rules has no record list; Calendar and the like are one form).
const PARTS = [['lore', '.st-lorerow', 'entry'], ['cast', '.st-crow', 'person'], ['map', '.st-prow', 'place'], ['events', '.st-eventrow', 'event'],
    ['templates', '.st-trow', 'template'], ['powers', '[data-rec^="powers."]', 'power'], ['items', null, 'item'], ['names', '.st-open[data-rec^="names."]', 'culture']];
// (Ersveil has no items: the Items part shows its empty list and the empty pane)

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

async function studio(width, theme = 'dark', height = 900) {
    const page = await ctx.browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.addInitScript(value => localStorage.setItem('storySuite.studio.theme', value), theme);
    await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
    await page.waitForSelector('.st-app .st-start');
    await page.setInputFiles('.st-file', path.join(ROOT, 'examples/packs/ersveil.zip'));
    await page.waitForSelector('.st-foot:not([hidden])');
    return { page, errors };
}
const part = (page, id) => page.evaluate(key => (document.querySelector(`.snav .si3[data-part="${key}"]`)?.offsetParent ? document.querySelector(`.snav .si3[data-part="${key}"]`)
    : document.querySelector(`.phonelist .slist button[data-part="${key}"]`)).click(), id);
const rowOf = (page, sel) => page.evaluate(s => { const row = document.querySelector(`.st-wlist ${s}`); row.click(); return row.dataset.rec; }, sel);

// Where each side is and whether it shows; the page's own scroll, the nav's and the frame's, and how wide the document runs.
const layout = page => page.evaluate(() => {
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, shown: getComputedStyle(el).display !== 'none' && r.width > 0 }; };
    const q = sel => document.querySelector(sel);
    return {
        panes: q('.sbody').dataset.panes, list: box(q('.st-wlist')), rec: box(q('.st-wrec')), empty: box(q('.st-wrec > .st-pane-empty')), title: box(q('.st-wlist .st-ptitle')),
        back: box(q('.st-wrec .st-back')), open: q('.st-wide')?.dataset.open, current: [...document.querySelectorAll('.st-wlist [aria-current="true"]')].map(el => el.dataset.rec),
        recs: [...document.querySelectorAll('.st-wrec > .st-pane-rec')].length, main: q('.smain').scrollTop, nav: q('.snav').scrollTop, frame: q('.sbody').scrollTop + q('.glass').scrollTop,
        search: box(q('.snav .psrch')), listTop: q('.st-wlist')?.scrollTop ?? 0, recTop: q('.st-wrec')?.scrollTop ?? 0, wide: document.documentElement.scrollWidth,
    };
});

for (const width of [1280, 1920]) {
    for (const theme of ['dark', 'light']) {
        test(`at ${width} (${theme}): every record part shows nav | list | record, the empty pane, the open row marked, no back button`, async t => {
            if (ctx.skip) return t.skip(ctx.skip);
            const { page, errors } = await studio(width, theme);
            for (const [id, row, noun] of PARTS) {
                if (id === 'names') { await page.click('.pswitch button[data-kind="game"]'); }
                await part(page, id);
                let seen = await layout(page);
                assert.equal(seen.panes, 'true', `${id}: the page has panes`);
                assert.ok(seen.list.shown && seen.rec.shown && seen.empty.shown, `${id}: both sides and the empty pane`);
                assert.ok(seen.rec.left >= seen.list.right - 1, `${id}: the record side is beside the list`);
                assert.ok(seen.title.shown, `${id}: the page title heads the list`);
                assert.match(await page.textContent('.st-pane-empty'), new RegExp(`No ${noun} open`));
                if (!row) continue;
                const rec = await rowOf(page, row);
                seen = await layout(page);
                assert.equal(seen.open, 'true', `${id}: a record is open`);
                assert.equal(seen.empty, null, `${id}: the empty pane goes`);
                assert.ok(seen.list.shown && seen.rec.shown && seen.rec.left >= seen.list.right - 1, `${id}: the list stays beside the record`);
                assert.equal(seen.recs, 1, `${id}: one record`);
                assert.equal(seen.back?.shown ?? false, false, `${id}: no back button beside the list`);
                assert.deepEqual(seen.current, [rec], `${id}: its row is marked`);
                assert.ok(seen.wide <= width, `${id}: nothing runs sideways`);
            }
            assert.deepEqual(errors, []);
            await page.close();
        });
    }
}

test('at 1280: opening a record leaves the list where it was; an edit keeps both sides; the sides scroll on their own, not the page', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page, errors } = await studio(1280);
    await part(page, 'lore');
    await page.$eval('.st-wlist', el => { el.scrollTop = 900; });
    const before = (await layout(page)).listTop;
    assert.ok(before > 0);
    const rec = await page.evaluate(() => { const side = document.querySelector('.st-wlist').getBoundingClientRect(); const row = [...document.querySelectorAll('.st-wlist .st-lorerow')].find(el => el.getBoundingClientRect().top > side.top + 40); row.click(); return row.dataset.rec; });
    let seen = await layout(page);
    assert.equal(seen.listTop, before, 'the list did not jump');
    assert.deepEqual(seen.current, [rec]);
    const at = Number(rec.split('.')[1]);
    await page.fill('.st-wrec .srow[data-key="order"] input', '7'); // a field below the fold (fill scrolls the box to it)
    const recTop = (await layout(page)).recTop;
    assert.ok(recTop > 0);
    await page.press('.st-wrec .srow[data-key="order"] input', 'Tab');
    await page.waitForFunction(n => window.storySuiteStudio.state.packs.world.doc.content.lore[n].order === 7, at);
    seen = await layout(page);
    assert.equal(seen.listTop, before, 'an edit keeps the list scroll');
    assert.equal(seen.recTop, recTop, 'and the record scroll');
    assert.equal(seen.main, 0, 'the page itself does not scroll');
    // Places & routes: one list holds places, routes and regions; a route opens beside it, in the one record side.
    await part(page, 'map');
    const route = await rowOf(page, '[data-rec^="routes."]');
    seen = await layout(page);
    assert.deepEqual([seen.recs, seen.current], [1, [route]]);
    assert.ok(await page.locator('.st-wlist .st-prow[data-rec^="places."]').count() > 0, 'the places list stays');
    assert.deepEqual(errors, []);
    await page.close();
});

test('Go to (C22): the record opens at the field and only its own box scrolls; the nav and its search stay in view', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    for (const width of [1280, 1143]) {
        const { page, errors } = await studio(width, 'dark', 760);
        await page.evaluate(() => window.storySuiteStudio.show('lore', 'lore.120', { path: ['text'] }));
        let seen = await layout(page);
        assert.deepEqual([seen.nav, seen.frame], [0, 0], `${width}: the nav and the frame did not scroll`);
        assert.ok(seen.search.top >= 0 && seen.search.bottom <= 760, `${width}: the nav's search shows`);
        const field = await page.evaluate(() => { const el = document.activeElement; const r = el.getBoundingClientRect(); return { tag: el.tagName, top: r.top, bottom: r.bottom, rec: el.closest('[data-rec]')?.dataset.rec }; });
        assert.deepEqual([field.tag, field.rec], ['TEXTAREA', 'lore.120']);
        assert.ok(field.top >= 0 && field.top < 760, `${width}: the field is in view`);
        await part(page, 'problems');
        await part(page, 'pairing');
        seen = await layout(page);
        assert.deepEqual([seen.nav, seen.frame], [0, 0], `${width}: Pairing leaves the nav at its top`);
        assert.deepEqual(errors, []);
        await page.close();
    }
});

for (const width of [1143, 390]) {
    test(`at ${width}: one side at a time, the record with its back button, and back to the list`, async t => {
        if (ctx.skip) return t.skip(ctx.skip);
        const { page, errors } = await studio(width);
        for (const [id, row] of [['lore', '.st-lorerow'], ['map', '.st-prow'], ['cast', '.st-crow']]) {
            await part(page, id);
            let seen = await layout(page);
            assert.ok(!seen.rec.shown, `${id}: the list alone`);
            assert.ok(await page.locator(`.spage ${row}`).first().isVisible(), `${id}: its rows show`);
            await page.evaluate(s => document.querySelector(`.st-wlist ${s}`).click(), row);
            seen = await layout(page);
            assert.ok(seen.back.shown, `${id}: the record alone, with its back button`);
            assert.equal(await page.locator(`.spage ${row}`).first().isVisible(), false, `${id}: the list is hidden`);
            await page.click('.st-wrec .st-back');
            seen = await layout(page);
            assert.equal(seen.open, 'false', `${id}: back to the list`);
            assert.ok(seen.wide <= width, 'nothing runs sideways');
        }
        assert.deepEqual(errors, []);
        await page.close();
    });
}

test('a part without panes is laid out as before at 1280 (Overview: one column, its title shown)', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page } = await studio(1280);
    await part(page, 'overview');
    assert.equal(await page.getAttribute('.sbody', 'data-panes'), 'false');
    assert.ok(await page.locator('.spage > .st-ptitle').isVisible());
    await page.close();
});

test('the shell alone: sections join into one list and one record side; the empty pane comes and goes; a stale record pane goes', () => {
    installFakeDom();
    const host = document.createElement('div');
    const noop = () => {};
    const shell = createShell({ host, onOpen: noop, onExportZip: noop, onExportJson: noop, onUndo: noop, onRedo: noop, onTheme: noop, onPick: noop, onQuery: noop, onBack: noop, onProblems: noop, onGoFirst: noop });
    const made = [];
    const panes = (open, { withNew = true, rec = 'places.0', noun } = {}) => {
        const box = document.createElement('div');
        box.className = 'st-panes';
        box.dataset.open = String(open);
        if (noun) box.dataset.noun = noun;
        const list = document.createElement('div');
        list.className = 'st-pane-list';
        if (withNew) { const add = document.createElement('button'); add.className = 'btn2 st-add'; add.textContent = '+ Add a place'; add.addEventListener('click', () => made.push(1)); list.append(add); }
        const row = document.createElement('button');
        row.dataset.rec = rec;
        list.append(row);
        const pane = document.createElement('div');
        pane.className = 'st-pane-rec';
        if (open) { const page = document.createElement('section'); page.dataset.rec = rec; pane.append(page); }
        box.append(list, pane);
        return box;
    };
    shell.setPage({ title: 'Places', nodes: [panes(false), panes(false, { withNew: false, rec: 'routes.0' })] });
    const body = shell.el.querySelector('.sbody');
    assert.equal(body.getAttribute('data-panes'), 'true');
    assert.equal(shell.el.querySelectorAll('.st-wide').length, 1);
    assert.equal(shell.el.querySelectorAll('.st-wlist .st-panes').length, 2, 'both sections in the one list side');
    assert.match(shell.el.querySelector('.st-wrec .st-pane-empty').textContent, /No record open.*Add a place/);
    shell.el.querySelector('.st-pane-new').click();
    assert.equal(made.length, 1);
    const routes = panes(true, { withNew: false, rec: 'routes.3' });
    shell.setPage({ title: 'Places', nodes: [panes(false), routes] });
    assert.equal(shell.el.querySelector('.st-pane-empty'), null);
    assert.equal(shell.el.querySelector('.st-wrec > .st-pane-rec [data-rec]').dataset.rec, 'routes.3');
    assert.equal(shell.el.querySelector('.st-wlist [aria-current="true"]').dataset.rec, 'routes.3');
    assert.equal(shell.el.querySelector('.st-wide').dataset.open, 'true');
    // the editor draws again inside its own box (as lore does): the old record pane goes, the new one takes its place (the fake DOM has
    // no MutationObserver, so the fit the observer would run is run here)
    const again = panes(true, { withNew: false, rec: 'routes.4' });
    routes.replaceChildren(...again.childNodes);
    fitPanes(body, shell.el.querySelector('.spage'));
    assert.equal(shell.el.querySelectorAll('.st-wrec > .st-pane-rec').length, 1);
    assert.equal(shell.el.querySelector('.st-wrec > .st-pane-rec [data-rec]').dataset.rec, 'routes.4');
    const bare = panes(false, { withNew: false, noun: 'place' });
    shell.setPage({ title: 'Places', nodes: [bare] });
    assert.match(shell.el.querySelector('.st-pane-empty').textContent, /No place open.*Pick one in the list\.$/);
    assert.equal(shell.el.querySelector('.st-pane-new'), null);
    shell.setPage({ title: 'Problems', nodes: [document.createElement('section')] });
    assert.equal(body.getAttribute('data-panes'), 'false');
});
