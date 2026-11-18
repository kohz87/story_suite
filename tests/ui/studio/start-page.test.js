// The start page (ST-START-PAGE): Open, New world and New game; the blank packs pass the pack check; the New sheet makes the id from the
// name until it is typed by hand, refuses an id the checker would, and opens the pack through openDoc; and, rendered in Chromium, New
// world and New game open a pack in the Studio itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderPage, openNewSheet } from '../../../studio/views/start.js';
import { blankPack, idFromName, idProblem } from '../../../studio/model/blank.js';
import { validatePack, SUITE_VERSION } from '../../../packs/validate.js';
import { PACK_FIELDS_V4 } from '../../../packs/limits.js';
import { serve } from './serve.js';

const type = (box, value) => { box.value = value; box.dispatch('input'); };

test('a blank world and a blank game pass the pack check, with their keys in the checker\'s order', () => {
    for (const kind of ['world', 'game']) {
        const doc = blankPack(kind, { name: ' Saltmarsh ', id: 'saltmarsh' });
        assert.deepEqual(doc, { id: 'saltmarsh', format: 4, kind, version: '0.1.0', name: 'Saltmarsh', requires: { suite: `^${SUITE_VERSION.split('.').slice(0, 2).join('.')}` }, content: {} });
        assert.deepEqual(Object.keys(doc), PACK_FIELDS_V4.filter(key => key in doc));
        const checked = validatePack(doc);
        assert.equal(checked.ok, true, JSON.stringify(checked.errors));
        assert.deepEqual(checked.warnings ?? [], []);
    }
    assert.equal('name' in blankPack('world', { id: 'x' }), false, 'no name: the checker uses the id');
});

test('an id is made from the name, and the checker\'s id rules are said in words', () => {
    assert.equal(idFromName('Ersveil (open world)'), 'ersveil-open-world');
    assert.equal(idFromName('  Café Noir!  '), 'cafe-noir');
    assert.equal(idFromName('x'.repeat(60)).length, 40);
    assert.equal(idFromName('雪'), '');
    assert.equal(idProblem('saltmarsh'), '');
    assert.match(idProblem(''), /needs an id/);
    assert.match(idProblem('Salt Marsh'), /lowercase/);
    assert.match(idProblem('chat'), /kept for blocks/);
});

test('the page has Open, New world and New game; Open asks for the file picker', () => {
    installFakeDom();
    let picked = 0;
    const root = document.createElement('div');
    root.append(...renderPage({ pick: () => { picked++; } }));
    assert.deepEqual(root.querySelectorAll('.sgrp > .gt').map(node => node.textContent), ['Open', 'New']);
    root.querySelector('.st-start').click();
    assert.equal(picked, 1);
    assert.deepEqual(root.querySelectorAll('.st-new').map(button => button.textContent), ['New world', 'New game']);
    root.querySelector('.st-new[data-kind="game"]').click();
    const sheet = document.querySelector('.sh-ov');
    assert.ok(sheet);
    assert.match(sheet.textContent, /New game/);
    assert.match(sheet.textContent, /Built-in game/);
});

test('the New sheet follows the name until the id is typed, refuses a bad id, and opens the blank pack through openDoc', () => {
    installFakeDom();
    const opened = [];
    const sheet = openNewSheet({ openDoc: given => { opened.push(given); return { ok: true }; } }, 'world');
    const [name, id] = ['name', 'id'].map(key => sheet.el.querySelector(`[data-key="${key}"] input`));
    const create = sheet.el.querySelector('.st-create');
    assert.equal(create.disabled, true, 'nothing typed yet');
    assert.equal(sheet.el.querySelector('[data-key="id"] .st-problem'), null, 'and no problem said yet');
    type(name, 'Salt Marsh');
    assert.equal(id.value, 'salt-marsh');
    assert.equal(create.disabled, false);
    type(id, 'Bad Id');
    assert.equal(create.disabled, true);
    assert.match(sheet.el.querySelector('[data-key="id"] .st-problem').textContent, /lowercase/);
    type(name, 'Saltmarsh');
    assert.equal(id.value, 'Bad Id', 'an id typed by hand is kept');
    type(id, '');
    type(name, 'Saltmarsh');
    assert.equal(id.value, 'saltmarsh', 'a cleared id follows the name again');
    create.click();
    assert.equal(opened.length, 1);
    assert.deepEqual(opened[0].doc, blankPack('world', { name: 'Saltmarsh', id: 'saltmarsh' }));
    assert.equal(opened[0].kind, 'world');
    assert.equal(document.querySelector('.sh-ov'), null, 'the sheet closes');
});

test('a refusal from openDoc stays in the sheet; Cancel closes it with nothing opened', () => {
    installFakeDom();
    const sheet = openNewSheet({ openDoc: () => ({ ok: false, refusal: 'That is not a pack to open.' }) }, 'game');
    type(sheet.el.querySelector('[data-key="name"] input'), 'Coin rules');
    sheet.el.querySelector('.st-create').click();
    assert.equal(sheet.el.querySelector('p.st-problem').textContent, 'That is not a pack to open.');
    assert.ok(document.querySelector('.sh-ov'));
    sheet.el.querySelector('.st-cancel').click();
    assert.equal(document.querySelector('.sh-ov'), null);
});

// Rendered: the Studio's start page as served (its page context has no openDoc, so New goes in through Open's file input).
test('rendered: New world (at 1280) and New game (at 390) open blank packs the checker takes', async (t) => {
    let chromium;
    try { ({ chromium } = await import('playwright')); } catch (err) { if (process.env.CI === 'true') throw err; t.skip('Playwright unavailable'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch (err) { if (process.env.CI === 'true') throw err; t.skip(`Playwright browser unavailable: ${String(err.message).split('\n')[0]}`); return; }
    const { server, port } = await serve();
    try {
        for (const [width, kind, label] of [[1280, 'world', 'World'], [390, 'game', 'Game']]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const errors = [];
            page.on('pageerror', err => errors.push(err.message));
            await page.goto(`http://127.0.0.1:${port}/studio/index.html`);
            await page.waitForSelector(`.st-app .st-new[data-kind="${kind}"]`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `nothing runs sideways at ${width}`);
            await page.click(`.st-new[data-kind="${kind}"]`);
            await page.fill('.sh-ov [data-key="name"] input', 'Saltmarsh');
            assert.equal(await page.inputValue('.sh-ov [data-key="id"] input'), 'saltmarsh');
            await page.click('.sh-ov .st-create');
            await page.waitForSelector('.st-check[data-ok="true"]', { state: 'attached' });
            assert.match(await page.textContent('.shd'), new RegExp(`${label} · Saltmarsh · 0\\.1\\.0`));
            assert.equal(await page.$('.sh-ov'), null);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {
        await browser.close();
        await new Promise(done => server.close(done));
    }
});
