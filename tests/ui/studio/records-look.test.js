// Rendered check of the Studio's record lists and record heads in Chromium (mock MK-1 / MK-2), on the shipped Ersveil pair: list rows are
// left-aligned settings rows with tag pills and a ›, the filter chips are pills, the search is the filled settings box; an open record's
// title is the page heading under one back button, Delete opens a red card, a cast record has no ring round its page, the JSON row is a
// card; below 900 px the chips and row buttons are 44 px targets; in light, graph boxes keep a frame and a frozen place keeps a ring.
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

async function studio(width, theme = 'dark') {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript(value => localStorage.setItem('storySuite.studio.theme', value), theme);
  await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
  await page.waitForSelector('.st-app .st-start');
  await page.setInputFiles('.st-file', path.join(ROOT, 'examples/packs/ersveil.zip'));
  await page.waitForSelector('.st-foot:not([hidden])');
  return page;
}
async function part(page, id) {
  if (await page.locator('.snav').isVisible()) return page.click(`.snav .si3[data-part="${id}"]`);
  await page.evaluate(key => document.querySelector(`.phonelist .slist button[data-part="${key}"]`).click(), id); // the phone's parts list, from wherever the page is
}
const style = (page, sel, ...props) => page.locator(sel).first().evaluate((el, keys) => {
  const cs = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  return { ...Object.fromEntries(keys.map(key => [key, cs.getPropertyValue(key)])), w: box.width, h: box.height, top: box.top, visible: box.width > 0 && box.height > 0 };
}, props);

test('the lore list: rows are left-aligned filled rows with pill tags and a ›, the chips are pills, the search is filled', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await studio(1280);
  await part(page, 'lore');
  const row = await style(page, '.spage .st-lorerow', 'display', 'text-align', 'border-top-style', 'background-color', 'border-radius');
  assert.equal(row.display, 'grid');
  assert.equal(row['text-align'], 'left');
  assert.equal(row['border-top-style'], 'none');
  assert.notEqual(row['background-color'], 'rgba(0, 0, 0, 0)');
  assert.equal(row['border-radius'], '14px');
  assert.equal(await page.locator('.spage .st-lorerow').first().locator('.rcnt').textContent(), '›');
  const tag = await style(page, '.spage .st-lorerow .tg2', 'border-radius', 'display');
  assert.deepEqual([tag['border-radius'], tag.display], ['999px', 'inline-block']);
  const chip = await style(page, '.spage .st-filter[aria-pressed="true"]', 'border-radius', 'background-color', 'color');
  assert.equal(chip['border-radius'], '999px');
  assert.equal(chip['background-color'], 'rgba(168, 151, 255, 0.18)', 'the pressed chip is lit');
  const search = await style(page, '.spage .st-search', 'background-color', 'border-radius');
  assert.notEqual(search['background-color'], 'rgba(0, 0, 0, 0)');
  assert.equal(search['border-radius'], '12px');
  await page.close();
});

test('an open record: one back button, the title as the page heading, Delete opens a red card; a cast page has no ring; the JSON row is a card', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  for (const width of [1280, 390]) {
    const page = await studio(width);
    await part(page, 'lore');
    await page.locator('.spage .st-lorerow').first().click();
    assert.equal(await page.locator('.spage .st-ptitle').isVisible(), false, `${width}: the page title gives way`);
    assert.equal(await page.locator('.spage .sback').isVisible(), false, `${width}: no "‹ Parts" over the record`);
    assert.equal(await page.locator('.spage .st-back').count(), 1);
    const back = await style(page, '.spage .st-back'), dup = await style(page, '.spage .st-dup');
    assert.ok(Math.abs(back.top - dup.top) < 4, `${width}: back and Duplicate share a row`);
    assert.equal((await style(page, '.spage .st-entryhead b', 'font-size'))['font-size'], '22px');
    await page.click('.spage .st-del');
    const card = await style(page, '.spage .st-delcard', 'border-top-color');
    assert.ok(card.visible);
    assert.match(await page.locator('.spage .st-delcard').textContent(), /^Delete “.+”\?.*Undo brings it back\.DeleteKeep it$/);
    assert.equal(card['border-top-color'], 'rgba(255, 107, 107, 0.4)');
    assert.equal(await page.locator('.spage .st-del').count(), 1, 'the head keeps its Delete');
    await page.click('.spage .st-keep');
    assert.equal(await page.locator('.spage .st-delcard').count(), 0);
    assert.notEqual((await style(page, '.spage .st-jsonrow', 'background-color'))['background-color'], 'rgba(0, 0, 0, 0)');
    await part(page, 'cast');
    await page.locator('.spage .st-crow').first().click();
    assert.equal((await style(page, '.spage section.st-rec', 'box-shadow'))['box-shadow'], 'none');
    await page.close();
  }
});

test('below 900 px the filter chips and the table row buttons are 44 px targets', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await studio(390);
  await part(page, 'lore');
  assert.ok((await style(page, '.spage .st-filter')).h >= 44, 'filter chip');
  await part(page, 'calendar');
  const button = await style(page, '.spage .st-table .st-tacts .btn2');
  assert.ok(button.w >= 44 && button.h >= 44, `row button ${button.w}×${button.h}`);
  await page.close();
});

test('light: a graph box keeps a visible frame, a frozen place keeps a grey ring, warning text uses the dark amber', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await studio(1280, 'light');
  await part(page, 'map');
  await page.click('.st-seg button[data-view="map"]');
  await page.click('.spage button[data-colour="climates"]');
  assert.equal(await page.locator('.spage .pl[data-climate="frozen"] circle.b').first().evaluate(el => getComputedStyle(el).stroke), 'rgb(154, 167, 182)');
  const probe = await page.evaluate(() => {
    const root = document.querySelector('.st-root');
    const node = Object.assign(document.createElement('div'), { className: 'st-gnode' });
    const warn = Object.assign(document.createElement('div'), { className: 'st-prob' });
    warn.dataset.level = 'warning';
    warn.append(Object.assign(document.createElement('span'), { className: 'lb' }));
    warn.firstChild.append(document.createElement('small'));
    root.append(node, warn);
    const out = { frame: getComputedStyle(node).borderTopColor, warn: getComputedStyle(warn.querySelector('small')).color };
    node.remove(); warn.remove();
    return out;
  });
  assert.equal(probe.frame, 'rgba(30, 34, 52, 0.2)');
  assert.equal(probe.warn, 'rgb(122, 74, 0)');
  await page.close();
});
