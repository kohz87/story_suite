// Rendered check: the activity tab is named after the activity and carries the Basic view note, at 390, 1143, 1280 and 1920, dark and light; the note stays inside the tab.
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


for (const width of [390, 1143, 1280, 1920]) {
  for (const theme of ['dark', 'light']) {
    test(`activity tab at ${width} in ${theme}: its title on the tab, the Basic view note, nothing sideways`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&scene=open&tab=scene`);
        await page.waitForSelector('#hx-frame .scene-tab .scene-basic');
        const m = await page.evaluate(() => {
          const q = s => document.querySelector(`#hx-frame ${s}`);
          const tab = q('.scene-tab'), note = q('.scene-basic'), box = e => e.getBoundingClientRect();
          return {
            label: q('.su-strip .su-tab[data-tab="scene"]').textContent,
            labels: [...document.querySelectorAll('#hx-frame .su-strip .su-tab')].map(n => n.textContent),
            note: note.textContent,
            noteInside: box(note).right <= box(tab).right + 1 && box(note).left >= box(tab).left - 1,
            noteVisible: getComputedStyle(note).display !== 'none' && box(note).height > 0,
            sideways: tab.scrollWidth > tab.clientWidth + 1,
          };
        });
        assert.equal(m.label, 'The ferry cross…');
        assert.equal(m.labels.includes('Scene'), false);
        assert.equal(m.note, 'Basic view: this activity has no view of its own.');
        assert.ok(m.noteVisible && m.noteInside);
        assert.equal(m.sideways, false);
        await page.screenshot({ path: `/tmp/scenefold-${width}-${theme}.png` });
      } finally {
        await page.close();
      }
    });
  }
}
