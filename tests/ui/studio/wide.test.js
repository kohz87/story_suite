// The wide layout (ST-WIDE, mock MK-2): a record part whose page holds the two panes (shell.js) shows nav | list | record at 1280 px and
// wider, each pane scrolling on its own, with the "No entry open" pane and its New button while nothing is open; below 1280 one pane shows
// at a time, as before. Rendered in Chromium with a lore editor of the test's own that follows the contract, plus the shell alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve } from './serve.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createShell } from '../../../studio/shell.js';

const WORLD4 = path.join(ROOT, 'tests/packs/studio/fixtures/world4-mini.json');

// A lore editor that draws both panes: the list (its head, New, many rows) and the open entry, switching locally as the real ones do.
const LORE = `import { h } from '/ui/kit/dom.js';
export function editSection(section, ctx) {
  const state = ctx.keep('wide-test');
  const box = h('div', { class: 'st-panes', dataset: { noun: 'entry', icon: '✎' } });
  const rows = Array.from({ length: 80 }, (_, i) => ({ title: section.value[i % section.value.length]?.title ?? 'Entry', i }));
  const draw = () => {
    box.dataset.open = String(typeof state.open === 'number');
    const list = h('div', { class: 'st-pane-list' }, h('div', { class: 'st-lhead' }, h('b', 'Lore'), h('button', { type: 'button', class: 'btn2 pri', dataset: { act: 'new' }, onClick: () => { window.__made = (window.__made ?? 0) + 1; } }, 'New entry')),
      rows.map(row => h('button', { type: 'button', class: 'sgrp st-lrow', dataset: { rec: 'lore.' + row.i }, 'aria-current': String(state.open === row.i), onClick: () => { state.open = row.i; draw(); } }, row.title + ' ' + row.i)));
    const rec = h('div', { class: 'st-pane-rec' }, typeof state.open === 'number' ? [h('button', { type: 'button', class: 'btn2 st-back', onClick: () => { state.open = null; draw(); } }, '‹ Lore'),
      h('h3', { class: 'st-rtitle' }, 'Entry ' + state.open), Array.from({ length: 60 }, (_, n) => h('p', 'Line ' + n))] : []);
    box.replaceChildren(list, rec);
  };
  draw();
  return [h('div', { class: 'st-sec' }, box)];
}`;

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

async function lorePage(width, theme = 'dark') {
    const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route('**/*', route => {
        const url = route.request().url();
        if (!url.startsWith(`http://127.0.0.1:${ctx.port}/`)) return route.abort();
        return new URL(url).pathname === '/studio/edit/lore.js' ? route.fulfill({ contentType: 'text/javascript', body: LORE }) : route.continue();
    });
    await page.addInitScript(value => localStorage.setItem('storySuite.studio.theme', value), theme);
    await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
    await page.waitForSelector('.st-app .st-start');
    await page.setInputFiles('.st-file', WORLD4);
    await page.waitForSelector('.st-foot:not([hidden])');
    await page.click(width < 601 ? '.slist button[data-part="lore"]' : '.snav .si3[data-part="lore"]');
    await page.waitForSelector('.st-panes');
    return { page, errors };
}

// Where each pane is and whether it shows; the page's own scroll and how wide the document runs.
const layout = page => page.evaluate(() => {
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, shown: getComputedStyle(el).display !== 'none' && r.width > 0 }; };
    return {
        panes: document.querySelector('.sbody').dataset.panes,
        list: box(document.querySelector('.st-pane-list')), rec: box(document.querySelector('.st-pane-rec')),
        empty: box(document.querySelector('.st-pane-empty')), title: box(document.querySelector('.spage > .st-ptitle')), back: box(document.querySelector('.st-pane-rec .st-back')),
        main: document.querySelector('.smain').scrollTop, wide: document.documentElement.scrollWidth,
    };
});

for (const width of [1280, 1920]) {
    for (const theme of ['dark', 'light']) {
        test(`at ${width} (${theme}): nav | list | record, the empty pane and its New, a record opened beside its list, panes scrolling on their own`, async t => {
            if (ctx.skip) return t.skip(ctx.skip);
            const { page, errors } = await lorePage(width, theme);
            let seen = await layout(page);
            assert.equal(seen.panes, 'true');
            assert.ok(seen.list.shown && seen.rec.shown && seen.empty.shown, 'both panes and the empty pane show');
            assert.ok(seen.rec.left >= seen.list.right - 1, 'the record is beside the list');
            assert.equal(seen.title.shown, false, 'the page title moves into the list head');
            assert.match(await page.textContent('.st-pane-empty'), /No entry open.*Pick one in the list, or make a new one\.New entry/);
            await page.click('.st-pane-new');
            assert.equal(await page.evaluate(() => window.__made), 1, 'the empty pane\'s New presses the list\'s New');
            await page.click('.st-lrow[data-rec="lore.3"]');
            seen = await layout(page);
            assert.equal(seen.empty, null, 'the empty pane goes once a record is open');
            assert.ok(seen.list.shown && seen.rec.shown && seen.rec.left >= seen.list.right - 1);
            assert.equal(seen.back.shown, false, 'no back button while the list is beside the record');
            assert.equal(await page.getAttribute('.st-lrow[data-rec="lore.3"]', 'aria-current'), 'true');
            const before = (await layout(page)).rec.top;
            await page.$eval('.st-pane-list', el => { el.scrollTop = 900; });
            const scrolled = await page.evaluate(() => ({ list: document.querySelector('.st-pane-list').scrollTop, rec: document.querySelector('.st-pane-rec').scrollTop }));
            assert.ok(scrolled.list > 0 && scrolled.rec === 0, 'the list scrolls alone');
            seen = await layout(page);
            assert.equal(seen.main, 0, 'the page itself does not scroll');
            assert.equal(seen.rec.top, before);
            assert.ok(seen.wide <= width, 'nothing runs sideways');
            assert.deepEqual(errors, []);
            await page.close();
        });
    }
}

for (const width of [1143, 390]) {
    test(`at ${width}: one pane at a time, the record with its back button, and back to the list`, async t => {
        if (ctx.skip) return t.skip(ctx.skip);
        const { page, errors } = await lorePage(width);
        let seen = await layout(page);
        assert.ok(seen.list.shown && !seen.rec.shown, 'the list alone');
        assert.equal(seen.title.shown, true, 'the page title stays where it was');
        await page.click('.st-lrow[data-rec="lore.2"]');
        seen = await layout(page);
        assert.ok(!seen.list.shown && seen.rec.shown && seen.back.shown, 'the record alone, with its back button');
        await page.click('.st-pane-rec .st-back');
        seen = await layout(page);
        assert.ok(seen.list.shown && !seen.rec.shown);
        assert.ok(seen.wide <= width, 'nothing runs sideways');
        assert.deepEqual(errors, []);
        await page.close();
    });
}

test('a part without panes is laid out as before at 1280 (Overview: one column, its title shown)', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page } = await lorePage(1280);
    await page.click('.snav .si3[data-part="overview"]');
    const seen = await layout(page);
    assert.equal(seen.panes, 'false');
    assert.ok(seen.title.shown);
    await page.close();
});

test('the shell alone: setPage marks the panes once, the empty pane comes and goes with data-open, and a page without panes is unmarked', () => {
    installFakeDom();
    const host = document.createElement('div');
    const noop = () => {};
    const shell = createShell({ host, onOpen: noop, onExportZip: noop, onExportJson: noop, onUndo: noop, onRedo: noop, onTheme: noop, onPick: noop, onQuery: noop, onBack: noop, onProblems: noop, onGoFirst: noop });
    const made = [];
    const panes = (open, withNew = true) => {
        const box = document.createElement('div');
        box.className = 'st-panes';
        box.dataset.open = String(open);
        const list = document.createElement('div');
        list.className = 'st-pane-list';
        if (withNew) { const add = document.createElement('button'); add.dataset.act = 'new'; add.textContent = 'New place'; add.addEventListener('click', () => made.push(1)); list.append(add); }
        const rec = document.createElement('div');
        rec.className = 'st-pane-rec';
        box.append(list, rec);
        const wrap = document.createElement('div');
        wrap.append(box);
        return { wrap, box };
    };
    const first = panes(false);
    shell.setPage({ title: 'Places', nodes: [first.wrap] });
    const body = shell.el.querySelector('.sbody');
    assert.equal(body.getAttribute('data-panes'), 'true');
    assert.ok(first.wrap.classList.contains('st-panes-up'));
    assert.equal(shell.el.querySelectorAll('.st-pane-empty').length, 1);
    assert.match(shell.el.querySelector('.st-pane-empty').textContent, /No record open.*New place/);
    shell.el.querySelector('.st-pane-new').click();
    assert.equal(made.length, 1);
    const open = panes(true);
    shell.setPage({ title: 'Places', nodes: [open.wrap] });
    assert.equal(shell.el.querySelector('.st-pane-empty'), null);
    const bare = panes(false, false);
    bare.box.dataset.noun = 'place';
    shell.setPage({ title: 'Places', nodes: [bare.wrap] });
    assert.match(shell.el.querySelector('.st-pane-empty').textContent, /No place open.*Pick one in the list\.$/);
    assert.equal(shell.el.querySelector('.st-pane-new'), null);
    shell.setPage({ title: 'Problems', nodes: [document.createElement('section')] });
    assert.equal(body.getAttribute('data-panes'), 'false');
    assert.ok(fs.existsSync(WORLD4));
});
