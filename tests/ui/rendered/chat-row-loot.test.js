// Rendered check: the reply row with the Loot chip next to every other chip (money, Fight, Needs you, Choices, Suite, the unrecorded badge)
// fits at phone, tablet and desktop width, with the loot panel open and folded, and the chip keeps its word "Loot" (a bare number said nothing).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
const STYLES = ['base', 'shell', 'kit', 'card', 'now', 'chat', 'loot', 'party', 'bag', 'fight', 'people', 'dossier', 'world', 'journal', 'story', 'settings'];
const page = fight => `<!doctype html><meta charset="utf-8"><style>
:root{--SmartThemeBodyColor:#ddd;--SmartThemeEmColor:#999;--SmartThemeBorderColor:#444;--SmartThemeBlurTintColor:#222;--SmartThemeChatTintColor:#111;--SmartThemeBotMesBlurTintColor:#2a2a2a;--SmartThemeShadowColor:#0006;--SmartThemeUnderlineColor:#c44}
body{margin:0;background:#111;color:#ddd;font:15px sans-serif}.drawer{display:flex;flex-flow:row;width:100%}.mes{display:flex;padding:10px 10px 0;width:100%;box-sizing:border-box}.mes_block{padding-left:10px;width:100%;overflow-x:hidden}
</style>${STYLES.map(n => `<link rel="stylesheet" href="/ui/css/${n}.css">`).join('')}
<div id="chat"><div class="mes last_mes"><div class="mes_block"><div class="mes_text">A reply.</div></div></div></div><div id="send_form"></div>
<script type="module">
import { fixture } from '/ui/fixtures/index.js';
import { createChatSurfaces } from '/ui/chat/chat-surfaces.js';
const host = document.createElement('div'); host.className = 'ss-drawer-host';
document.body.insertBefore(host, document.getElementById('send_form'));
const vm = structuredClone(fixture().chat);
const items = ['Iron shortsword', 'Healing draught ×2', 'Leather jerkin', 'Chain hauberk', 'Iron ingot ×30'].map((label, at) => ({ at, label }));
vm.inlineRow = { ...vm.inlineRow, unrecorded: true, needsYou: { n: 2, title: 'overdue' }, choices: ['Go on', 'Wait'], changes: 3, notApplied: 1, fightOpen: ${fight},
  loot: [{ sid: 'sw_test', where: 'in the rotted chest', taken: false, items }] };
vm.drawer = [];
createChatSurfaces({ messagesEl: document.getElementById('chat'), drawerHost: host, isNarrow: () => innerWidth < 600, handlers: {} }).refresh(vm);
document.body.dataset.ready = '1';
</script>`;

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/chat.html' || url.pathname === '/chat-fight.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page(url.pathname === '/chat-fight.html')); return; }
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
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

// The row and everything in it fit: no sideways scroll of the row or the page, and every chip of the second line inside the row.
const measure = () => {
  const row = document.querySelector('.ssrow');
  const r = row.getBoundingClientRect();
  const outside = [...row.querySelectorAll('.ssl2 > *, .lootpk, .lootpk *')].filter(el => el.getClientRects().length)
    .filter(el => { const b = el.getBoundingClientRect(); return b.left < r.left - 0.5 || b.right > r.right + 0.5; }).map(el => el.className || el.tagName);
  const chip = document.querySelector('.ssbtn[data-loot]');
  const label = chip.querySelector('.lb');
  return { scroll: row.scrollWidth, client: row.clientWidth, docScroll: document.documentElement.scrollWidth, view: innerWidth, outside,
    word: Boolean(label && label.getClientRects().length && getComputedStyle(label).display !== 'none'), chipText: chip.textContent.trim(), h: Math.round(chip.getBoundingClientRect().height) };
};

for (const fight of [false, true]) {
  for (const width of [390, 1143, 1280]) {
    test(`${width}px${fight ? ', a fight open' : ''}: the Loot chip keeps its word and the row fits, panel open and folded`, async (t) => {
      if (ctx.skip) return t.skip(ctx.skip);
      const tab = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      await tab.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
      await tab.goto(`http://127.0.0.1:${ctx.port}/${fight ? 'chat-fight' : 'chat'}.html`);
      await tab.waitForSelector('body[data-ready] .ssbtn[data-loot]');
      for (const state of ['open', 'folded']) {
        if (state === 'folded') await tab.click('.ssbtn[data-loot]');
        const got = await tab.evaluate(measure);
        assert.equal(got.word, true, `${state}: the chip shows the word Loot (${got.chipText})`);
        assert.match(got.chipText, /Loot\s*5/);
        assert.ok(got.scroll <= got.client + 1, `${state}: the row's content (${got.scroll}) fits its width (${got.client})`);
        assert.ok(got.docScroll <= got.view, `${state}: the page does not scroll sideways`);
        assert.deepEqual(got.outside, [], `${state}: nothing sticks out of the row`);
        assert.ok(got.h >= 40, `${state}: a touch-sized chip (${got.h}px)`);
      }
      assert.equal(await tab.evaluate(() => document.querySelector('.sslootp').hasAttribute('hidden')), true, 'folded hides the panel');
      await tab.close();
    });
  }
}
