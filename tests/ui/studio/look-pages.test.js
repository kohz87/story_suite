// The review's page drifts (REVSTUDIO2 C6) against mocks MK-3, MK-4, MK-5 and MK-7, rendered in Chromium on the shipped Ersveil pair: the map
// zoomed out draws filled dots and realm names that do not cover each other; the busy at-war graph opens on whole columns with no line
// across the centre box; the picker keeps its count line in view; short words get small boxes; the Rules ranks have column heads; a
// culture's regions sit under its id.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT, serve } from './serve.js';

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

async function studio(width) {
    const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
    await page.waitForSelector('.st-app .st-start');
    await page.setInputFiles('.st-file', path.join(ROOT, 'examples/packs/ersveil.zip'));
    await page.waitForSelector('.st-foot:not([hidden])');
    return { page, errors };
}
const show = (page, id, rec = null) => page.evaluate(([part, at]) => window.storySuiteStudio.show(part, at), [id, rec]);
const width = (page, sel) => page.locator(sel).first().evaluate(el => el.getBoundingClientRect().width);

test('map zoomed out: places are filled dots, and no realm name covers another', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page, errors } = await studio(1280);
    await show(page, 'map');
    await page.click('[data-view="map"]');
    await page.waitForSelector('.st-mp .pl');
    const seen = await page.evaluate(() => {
        const dots = [...document.querySelectorAll('.st-mp .pl circle.b')].map(c => getComputedStyle(c).fill);
        const boxes = [...document.querySelectorAll('.st-mp .realm text')].map(el => el.getBoundingClientRect());
        const hits = boxes.flatMap((a, i) => boxes.slice(i + 1).filter(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)).length;
        const map = document.querySelector('.st-mp').getBoundingClientRect();
        return { filled: dots.filter(fill => fill !== 'rgb(35, 40, 58)' && !/^var/.test(fill)).length, all: dots.length, hits, names: boxes.length, inside: boxes.every(b => b.left >= map.left - 1 && b.right <= map.right + 1) };
    });
    assert.ok(seen.all > 300 && seen.filled === seen.all, `every place a filled dot (${seen.filled} of ${seen.all})`);
    assert.ok(seen.names > 2, 'some realm names are drawn');
    assert.equal(seen.hits, 0, 'no realm name covers another');
    assert.ok(seen.inside, 'every realm name is inside the map');
    const side = await page.evaluate(() => {
        const map = document.querySelector('.st-mp').getBoundingClientRect(), leg = document.querySelector('.st-mleg').getBoundingClientRect();
        const row = document.querySelector('.st-mreg'), sw = row.querySelector('.st-swatch').getBoundingClientRect(), name = row.querySelector('b').getBoundingClientRect();
        return { gap: leg.top - map.bottom, swatchFirst: sw.right <= name.left, more: row.textContent.trim().endsWith('›') };
    });
    assert.ok(side.gap >= -1 && side.gap < 40, `the legend sits right under the map (${side.gap})`);
    assert.ok(side.swatchFirst && side.more, 'a region row: its colour first, › last');
    assert.deepEqual(errors, []);
    await page.close();
});

test('the busy graph at 1280: whole columns, no box cut at an edge, no line through the centre box; its keys are lines', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page, errors } = await studio(1280);
    await show(page, 'events');
    await page.click('[data-view="graph"]');
    await page.evaluate(() => [...document.querySelectorAll('.spage button')].find(b => /at-war/.test(b.textContent)).click());
    await page.waitForTimeout(200);
    const seen = await page.evaluate(() => {
        const view = document.querySelector('.st-gscroll').getBoundingClientRect();
        const cut = [...document.querySelectorAll('.st-gcanvas > .st-gnode, .st-gcanvas > .st-gmore')].map(el => el.getBoundingClientRect())
            .filter(r => r.width > 0 && r.left < view.right - 1 && r.right > view.left + 1 && (r.left < view.left - 1 || r.right > view.right + 1)).length;
        const centre = document.querySelector('.st-gcanvas > .st-gnode.st-gcur');
        const box = centre.getBoundingClientRect();
        let through = 0;
        for (const path of document.querySelectorAll('.st-glines path.st-gl')) {
            const len = path.getTotalLength(), m = path.getScreenCTM();
            for (let at = 2; at < len - 2; at += 4) {
                const p = path.getPointAtLength(at), x = m.a * p.x + m.e, y = m.d * p.y + m.f;
                if (x > box.left + 14 && x < box.right - 14 && y > box.top + 6 && y < box.bottom - 6) { through += 1; break; }
            }
        }
        const key = document.querySelector('.st-gtype .st-gkey').getBoundingClientRect();
        return { cut, through, key: Math.round(key.height) };
    });
    assert.equal(seen.cut, 0, 'no box cut at the edges');
    assert.equal(seen.through, 0, 'no line crosses the centre box');
    assert.ok(seen.key <= 3, `the key is a line sample (${seen.key} px tall)`);
    assert.deepEqual(errors, []);
    await page.close();
});

test('the picker at 390 keeps its search at the top and its count line in view; a row\'s kind is a tag', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page, errors } = await studio(390);
    await show(page, 'events');
    await page.click('[data-view="graph"]');
    await page.evaluate(() => [...document.querySelectorAll('.spage button')].find(b => /Pick/.test(b.textContent)).click());
    const seen = await page.evaluate(() => {
        const count = [...document.querySelectorAll('.sh-panel .fine')].at(-1).getBoundingClientRect();
        const tag = document.querySelector('.sh-panel .slist b .tg2');
        return { bottom: count.bottom, text: document.querySelector('.sh-panel .sh-body > .fine').textContent, radius: getComputedStyle(tag).borderRadius };
    });
    assert.ok(seen.bottom <= 900, `the count line shows (${seen.bottom})`);
    assert.match(seen.text, /Esc closes/);
    assert.equal(seen.radius, '999px');
    assert.deepEqual(errors, []);
    await page.close();
});

test('short words get small boxes (Era, Currency, Its field, Shown as, Rank label, a culture id); the ranks have column heads; regions under the culture', async t => {
    if (ctx.skip) return t.skip(ctx.skip);
    const { page, errors } = await studio(1280);
    await show(page, 'calendar');
    assert.ok(await width(page, '.srow[data-key="era"] input') <= 161, 'Era');
    await show(page, 'money');
    for (const key of ['name', 'plural', 'short']) assert.ok(await width(page, `.st-currency .srow[data-key="${key}"] input`) <= 161, key);
    for (const part of ['money', 'names', 'calendar']) { // each table's heads sit over their columns (head and rows are grids of their own)
        await show(page, part);
        const lines = await page.evaluate(() => { const t = document.querySelector('.st-table'); const at = el => [...el.children].map(c => Math.round(c.getBoundingClientRect().left)); return [at(t.querySelector('.st-thead')), at(t.querySelector('.st-trow'))]; });
        assert.deepEqual(lines[0].slice(0, -1), lines[1].slice(0, lines[0].length - 1), `${part}: the heads line up`);
    }
    await show(page, 'rules');
    assert.ok(await width(page, '.srow[data-key="you.rank.label"] input') <= 221, 'Rank label');
    for (const key of ['rpg.playerRank.field', 'rpg.playerRank.label']) assert.ok(await width(page, `.srow[data-key="${key}"] input`) <= 161, key);
    const heads = await page.$$eval('.st-rhead span', spans => spans.map(s => [s.textContent, Math.round(s.getBoundingClientRect().left)]));
    assert.deepEqual(heads.map(([text]) => text), ['#', 'Rank', 'From', 'To']);
    const cells = await page.evaluate(() => { const row = document.querySelector('.st-rank'); return [row.querySelector('.st-rname'), row.querySelector('.st-rfrom'), row.querySelector('.st-rto')].map(el => Math.round(el.getBoundingClientRect().left)); });
    cells.forEach((left, i) => assert.ok(Math.abs(left - heads[i + 1][1]) <= 12, `${heads[i + 1][0]} sits over its column (${left} vs ${heads[i + 1][1]})`));
    await show(page, 'names');
    const cult = await page.evaluate(() => { const cell = document.querySelector('.st-cult'); return [cell.querySelector('b').getBoundingClientRect().bottom, cell.querySelector('small').getBoundingClientRect().top]; });
    assert.ok(cult[1] >= cult[0] - 1, 'the regions are on the line under the id');
    const id = Object.keys(await page.evaluate(() => window.storySuiteStudio.state.packs.game.doc.content.names)).find(key => key !== 'banned');
    await show(page, 'names', `names.${id}`);
    assert.ok(await width(page, '.srow[data-key="id"] input') <= 221, 'a culture id');
    assert.deepEqual(errors, []);
    await page.close();
});
