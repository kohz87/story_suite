// Rendered check of the suite's focus model in a real browser (soak #1, #2, #3, #12): the suite mounted on the page body as SillyTavern mounts it,
// with page controls behind it. Tab never reaches them, a Party sheet and the dossier keep Tab inside, and the browser's Back walks the stack.
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

// The harness page for its styles; its own suite is taken down and one is mounted on the body over a few page controls (`.behind`).
async function stPage(width) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 800 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?tab=now`);
  await page.waitForSelector('#hx-frame .su-root');
  await page.evaluate(async () => {
    globalThis.storySuiteHarness.suite().destroy();
    const { mountSuite } = await import('/ui/mount.js');
    const { createFakePort } = await import('/ui/port/fake-port.js');
    const st = document.createElement('div');
    st.id = 'sheld';
    for (const label of ['drawer', 'chat name', 'mes_button']) { const b = document.createElement('button'); b.className = 'behind'; b.textContent = label; st.appendChild(b); }
    document.body.prepend(st);
    globalThis.opener = st.querySelector('button');
    globalThis.opener.focus();
    globalThis.suite = mountSuite({ port: createFakePort(), doc: document, host: document.body });
    globalThis.suite.open('people');
  });
  await page.waitForSelector('body > .su-layer [data-person-id]');
  return page;
}
const where = page => page.evaluate(() => {
  const a = document.activeElement;
  return { behind: Boolean(a?.closest?.('.behind, #hx-controls')), suite: Boolean(a?.closest?.('.su-root')), body: a === document.body, dossier: Boolean(a?.closest?.('.dossier')), sheet: Boolean(a?.closest?.('.pty-sheet, .sh-panel')) };
});

for (const width of [390, 1280]) {
  test(`at ${width}: the suite takes the focus and 40 Tabs never reach the page behind it (soak #1)`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await stPage(width);
    assert.equal((await where(page)).suite, true, 'the focus is in the suite on open');
    let behind = 0;
    for (let n = 0; n < 40; n += 1) { await page.keyboard.press('Tab'); if ((await where(page)).behind) behind += 1; }
    assert.equal(behind, 0);
    await page.evaluate(() => globalThis.suite.close());
    assert.equal(await page.evaluate(() => document.activeElement === globalThis.opener), true, 'closing gives the focus back');
    assert.equal(await page.evaluate(() => document.querySelector('#sheld').inert), false);
    await page.close();
  });

  test(`at ${width}: the dossier keeps 20 Tabs inside, Escape returns the focus to the card, two Backs close it and the suite (soak #3, #12)`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await stPage(width);
    const start = await page.evaluate(() => history.length);
    await page.focus('body > .su-layer [data-person-id="torka"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.dossier');
    assert.equal((await where(page)).dossier, true, 'the focus moved into the dossier');
    let out = 0;
    for (let n = 0; n < 20; n += 1) { await page.keyboard.press('Tab'); if (!(await where(page)).dossier) out += 1; }
    assert.equal(out, 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.personId ?? null), 'torka');
    await page.focus('body > .su-layer [data-person-id="torka"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.dossier');
    await page.goBack({ waitUntil: 'commit' }).catch(() => null);
    await page.waitForFunction(() => !document.querySelector('.dossier'));
    assert.equal(await page.evaluate(() => document.querySelector('.su-layer').dataset.state), 'open', 'Back closed only the dossier');
    await page.waitForFunction(() => history.state?.storySuiteBack === true);
    await page.goBack({ waitUntil: 'commit' }).catch(() => null);
    await page.waitForFunction(() => document.querySelector('.su-layer').dataset.state === 'closed');
    assert.ok(page.url().includes('harness.html'), 'still on the page');
    assert.ok(await page.evaluate(() => history.length) >= start);
    await page.close();
  });
}

test('a Party sheet keeps 20 Tabs inside it (soak #2)', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await stPage(1280);
  await page.evaluate(() => globalThis.suite.open('party'));
  await page.click('body > .su-layer [data-slot="weapon"]');
  await page.waitForSelector('.pty-sheet');
  let out = 0;
  for (let n = 0; n < 20; n += 1) { await page.keyboard.press('Tab'); if (!(await where(page)).sheet) out += 1; }
  assert.equal(out, 0);
  await page.close();
});

test('a sheet with no close button (the tracker editor) keeps 14 Tabs and Shift+Tabs inside it', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await stPage(1280);
  await page.evaluate(() => globalThis.suite.open('story'));
  await page.click('body > .su-layer .wseg [data-value="trackers"]');
  await page.click('body > .su-layer .trk [data-act="edit"]');
  await page.waitForSelector('.sh-ov[data-sheet="tracker-editor"]');
  assert.equal((await where(page)).sheet, true, 'the sheet has the focus on open');
  let out = 0;
  for (const key of [...Array(14).fill('Tab'), ...Array(14).fill('Shift+Tab')]) { await page.keyboard.press(key); if (!(await where(page)).sheet) out += 1; }
  assert.equal(out, 0);
  await page.close();
});
