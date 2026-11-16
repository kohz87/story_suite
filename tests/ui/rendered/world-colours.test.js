// Rendered check: World news status words and faction stance chips use the approved mock colours, tints and fonts.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const STN = {
  dark: { friendly: ['rgb(79, 211, 154)', 'rgba(79, 211, 154, 0.13)'], warm: ['rgb(90, 160, 255)', 'rgba(127, 208, 255, 0.13)'], unfriendly: ['rgb(242, 180, 90)', 'rgba(242, 180, 90, 0.14)'], hostile: ['rgb(255, 123, 114)', 'rgba(255, 122, 122, 0.13)'] },
  light: { friendly: ['rgb(15, 111, 73)', 'rgba(79, 211, 154, 0.13)'], warm: ['rgb(29, 90, 168)', 'rgba(127, 208, 255, 0.13)'], unfriendly: ['rgb(138, 82, 0)', 'rgba(242, 180, 90, 0.14)'], hostile: ['rgb(168, 40, 32)', 'rgba(255, 122, 122, 0.13)'] },
};
const ST = {
  dark: { looming: 'rgb(242, 180, 90)', ongoing: 'rgb(255, 123, 114)', rumour: 'rgb(168, 151, 255)' },
  light: { looming: 'rgb(138, 82, 0)', ongoing: 'rgb(168, 40, 32)', rumour: 'rgb(90, 61, 208)' },
};

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

let ctx = null;
test.before(async () => {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    ctx = { browser, ...(await serve()) };
  } catch (err) {
    if (process.env.CI === 'true') throw err;
    ctx = { skip: `Playwright browser unavailable: ${String(err.message).split('\n')[0]}` };
  }
});
test.after(async () => {
  if (ctx?.browser) await ctx.browser.close();
  if (ctx?.server) await new Promise(done => ctx.server.close(done));
});

async function open(theme, view) {
  const page = await ctx.browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=390&tab=world`);
  await page.waitForSelector('#hx-frame .su-host');
  await page.click(`[data-value=${view}]`);
  await page.waitForSelector(view === 'factions' ? '.stn' : '.st');
  return page;
}

const style = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) return null;
  const c = getComputedStyle(e);
  return { color: c.color, bg: c.backgroundColor, size: c.fontSize, weight: c.fontWeight };
}, sel);

for (const theme of ['dark', 'light']) {
  test(`faction stance chips take the mock colour and tint in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await open(theme, 'factions');
    try {
      for (const [word, [color, bg]] of Object.entries(STN[theme])) {
        const s = await style(page, `.stn.${word}`);
        assert.ok(s, `a ${word} chip is shown`);
        assert.equal(s.color, color, `${word} text`);
        assert.equal(s.bg, bg, `${word} tint`);
        assert.equal(s.size, '12px');
        assert.equal(s.weight, '800');
      }
    } finally { await page.close(); }
  });

  test(`news status words and filter counts take the mock colour and font in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await open(theme, 'news');
    try {
      for (const [word, color] of Object.entries(ST[theme])) assert.equal((await style(page, `.st.${word}`)).color, color, word);
      const small = await style(page, '.fil .chip2 small');
      assert.equal(small.size, '12px');
      assert.equal(small.weight, '800');
    } finally { await page.close(); }
  });
}

test('the map search box uses the mock font', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await ctx.browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=dark&width=390&tab=world`);
    await page.waitForSelector('.mtools .psrch');
    const s = await style(page, '.mtools .psrch');
    assert.equal(s.size, '14px');
    assert.equal(s.weight, '600');
  } finally { await page.close(); }
});
