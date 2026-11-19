// Rendered check: the New character wizard from 1100 px is the mock's 920 x 720 dialog (scratch/design/redo/sheets-desktop.html): the 248 px
// summary card on the left, the step on the right, Back / Next in a footer row under both that never covers the step, the Stats step without a
// scroll; on a phone Reset sits above the stat rows, where the sticky footer cannot cover it; a resize across 1100 px keeps the step and the draft.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

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

const S = '#hx-frame [data-sheet="new-character"]';
async function open(width, height, theme, step) {
  const page = await ctx.browser.newPage({ viewport: { width, height } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&wizard=${step}`);
  await page.addStyleTag({ content: '#hx-controls{display:none!important}.hx-frame{height:100vh!important}' });
  await page.waitForSelector(S);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const box = (page, sel) => page.evaluate(sel => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right } : null; }, sel);

for (const theme of ['dark', 'light']) {
  for (const [width, height] of [[1280, 800], [1920, 1080]]) {
    test(`from 1100 px (${width}x${height}, ${theme}): a 920 x 720 dialog (720 high where the floating window allows: window less 48 px, less 48 px again), centred in the window, the card left, the step right, the footer its own row`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await open(width, height, theme, 'stats');
      const panel = await box(page, `${S} .sh-panel`);
      // the suite is a floating window (min(1280, window - 48) by min(940, window - 48)); the dialog is 920 by min(720, window height - 96) inside it
      const winH = Math.min(940, height - 48);
      assert.deepEqual([panel.w, panel.h], [920, Math.min(720, winH - 48)]);
      assert.ok(Math.abs(panel.x + panel.w / 2 - width / 2) <= 1 && Math.abs(panel.y + panel.h / 2 - height / 2) <= 1, 'centred in the floating window, which is centred in the screen');
      const card = await box(page, `${S} .wz-sum`), body = await box(page, `${S} .wz-body`), foot = await box(page, `${S} .wz-foot`);
      assert.equal(card.w, 248);
      assert.equal(card.x - panel.x, 23, 'the 22 px inset inside the 1 px border');
      assert.ok(body.x >= card.r + 24 - 0.5, 'the step beside the card');
      assert.ok(foot.y >= body.b - 0.5 && foot.b <= panel.b, 'the footer under the step, inside the panel');
      assert.equal(await page.evaluate(sel => { const b = document.querySelector(sel); return b.scrollHeight - b.clientHeight; }, `${S} .wz-body`), 0, 'Stats does not scroll');
      const reset = await box(page, `${S} [data-wiz="reset"]`), rows = await box(page, `${S} .wz-rows`);
      assert.ok(reset.y >= rows.b, 'Reset after the two columns of rows, above the footer');
      assert.ok(reset.b <= foot.y, 'Reset never under the footer');
      assert.equal(await page.evaluate(sel => getComputedStyle(document.querySelector(sel)).display, `${S} .wz-tiles`), 'grid');
      await page.close();
    });
  }
  test(`a phone (390, ${theme}): Reset above the stat rows, the card a row as before`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await open(390, 844, theme, 'stats');
    const reset = await box(page, `${S} [data-wiz="reset"]`), row = await box(page, `${S} .ps-st[data-stat="str"]`), foot = await box(page, `${S} .wz-foot`);
    assert.ok(reset.b <= row.y, 'Reset above STR');
    assert.ok(reset.b <= foot.y, 'not under Back / Next');
    assert.equal(await page.evaluate(sel => getComputedStyle(document.querySelector(sel)).display, `${S} .wz-tiles`), 'none');
    await page.close();
  });
}

test('a resize across 1100 px keeps the step and the draft; the dialog comes back at 920', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await open(1280, 800, 'dark', 'stats');
  const value = () => page.evaluate(sel => document.querySelector(sel).textContent, `${S} .ps-st[data-stat="int"] .v`);
  const before = Number(await value());
  await page.click(`${S} [data-plus="int"]`);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.evaluate(() => { document.querySelector('#hx-frame').style.width = '1000px'; });
  assert.equal(await page.getAttribute(S, 'data-step'), 'stats');
  assert.equal(Number(await value()), before + 1);
  assert.notEqual((await box(page, `${S} .sh-panel`)).w, 920);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { document.querySelector('#hx-frame').style.width = '1280px'; });
  assert.equal((await box(page, `${S} .sh-panel`)).w, 920);
  assert.equal(Number(await value()), before + 1);
  assert.equal(await page.getAttribute(S, 'data-step'), 'stats');
  await page.close();
});

test('after a Create that left something out: "made, but not …" and Done, no footer and no stray "null" text', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=1280`);
  await page.waitForSelector('#hx-frame .su-root');
  await page.evaluate(async () => {
    const { createNewWizard } = await import('/ui/wizard/wizard.js');
    // (a story whose Foes block has no room: Create makes the character and says what it left out)
    const world = { headState: () => ({}), readerName: () => 'Astra', rules: () => null, packNote: () => '', levels: () => ({ ranks: [] }), levelCap: () => 99, chatId: () => 'demo', rpgOn: () => true, hasYou: () => false, query: () => null,
      world: () => ({ started: true, persona: 'Astra', names: [], hasYou: false, full: false, room: true, free: 32, extras: { add: ['rules'], skipped: [{ role: 'foes', why: 'room' }] }, used: [] }) };
    const host = document.querySelector('#hx-frame .su-root');
    createNewWizard({ world, command: async () => ({ ok: true }), sheetCtx: () => ({ doc: document, backStack: null, sheetHost: host }) }).open();
    document.querySelector('#hx-frame [data-sheet="new-character"] .wz-steps button[data-value="review"]').click();
  });
  await page.click(`${S} .wz-foot [data-wiz="create"]`);
  await page.waitForSelector(`${S} [data-wiz="done"]`);
  assert.equal(await page.locator(`${S} .wz-foot`).count(), 0);
  assert.equal(await page.evaluate(sel => [...document.querySelector(sel).childNodes].some(node => node.nodeType === 3 && node.textContent.trim() === 'null'), `${S} .sh-body`), false);
  await page.close();
});
