// Rendered check of the Studio's record lists in Chromium, on the shipped Ersveil pair (examples/packs/ersveil.zip): no list prints a
// stray "null" (the DOM writes a null child as that text), a row with no icon in a settings list gives its text the row's width, and the
// editors' search, filters and New bar is not the dry run's 10 px hold bar (both used the class st-bar).
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

async function studio() {
  const page = await ctx.browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://127.0.0.1:${ctx.port}/studio/index.html`);
  await page.waitForSelector('.st-app .st-start');
  await page.setInputFiles('.st-file', path.join(ROOT, 'examples/packs/ersveil.zip'));
  await page.waitForSelector('.st-foot:not([hidden])');
  return page;
}
const part = (page, id) => page.click(`.snav .si3[data-part="${id}"]`);
const strays = page => page.evaluate(() => {
  const walk = document.createTreeWalker(document.querySelector('.spage'), NodeFilter.SHOW_TEXT);
  const out = [];
  while (walk.nextNode()) if (/^\s*(null|undefined)+\s*$/.test(walk.currentNode.nodeValue)) out.push(walk.currentNode.parentElement.className);
  return out;
});

test('no record list prints "null": lore (and filtered), cast, events, names and one culture', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await studio();
  for (const id of ['lore', 'cast', 'events', 'names']) {
    await part(page, id);
    assert.deepEqual(await strays(page), [], id);
  }
  await page.locator('.spage .st-open').first().click();
  assert.deepEqual(await strays(page), [], 'a culture');
  await part(page, 'lore');
  await page.click('.st-filter[data-filter="hidden"]');
  assert.deepEqual(await strays(page), [], 'lore, hidden only');
  await page.close();
});

test('a place or template row gives its text the row (no icon column), and the lore bar shows its search', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await studio();
  const textWidth = sel => page.locator(sel).first().evaluate(row => row.firstElementChild.getBoundingClientRect().width);
  await part(page, 'map');
  assert.ok(await textWidth('.spage .st-prow[data-rec="places.0"]') > 300, 'place row text');
  await part(page, 'templates');
  assert.ok(await textWidth('.spage .st-trow[data-rec="templates.0"]') > 300, 'template row text');
  await part(page, 'lore');
  const bar = await page.locator('.spage .st-bar').first().evaluate(el => el.getBoundingClientRect().height);
  assert.ok(bar > 30, `the lore bar is ${bar} px high`);
  assert.ok(await page.locator('.spage .st-search').isVisible());
  await page.close();
});
