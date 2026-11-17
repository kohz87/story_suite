// Rendered check: the chat row with the "No changes recorded — Re-read" badge next to every other chip (money, Needs you, Choices, Suite) never overflows at phone, tablet and desktop width.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
const STYLES = ['base', 'shell', 'kit', 'card', 'now', 'chat', 'party', 'bag', 'fight', 'people', 'dossier', 'world', 'journal', 'story', 'settings'];
const PAGE = `<!doctype html><meta charset="utf-8"><style>
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
vm.inlineRow = { ...vm.inlineRow, unrecorded: true, needsYou: { n: 2, title: 'overdue' }, choices: ['Go on', 'Wait'], changes: 3, notApplied: 1 };
vm.drawer = [];
createChatSurfaces({ messagesEl: document.getElementById('chat'), drawerHost: host, isNarrow: () => innerWidth < 600, handlers: { onReread: () => { document.body.dataset.reread = '1'; } } }).refresh(vm);
document.body.dataset.ready = '1';
</script>`;

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/chat.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
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

async function open(width) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/chat.html`);
  await page.waitForSelector('body[data-ready] [data-unrecorded]');
  return page;
}

for (const width of [390, 1143, 1280]) {
  test(`${width}px: the badge is a visible Re-read button inside the row, the row does not overflow`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const page = await open(width);
    const got = await page.evaluate(() => {
      const row = document.querySelector('.ssrow'), badge = document.querySelector('[data-unrecorded]');
      const r = row.getBoundingClientRect(), b = badge.getBoundingClientRect();
      return { text: badge.textContent.trim(), tag: badge.tagName, scroll: row.scrollWidth, client: row.clientWidth, docScroll: document.documentElement.scrollWidth, view: innerWidth, inside: b.left >= r.left - 0.5 && b.right <= r.right + 0.5, h: Math.round(b.height) };
    });
    assert.equal(got.tag, 'BUTTON');
    assert.match(got.text, /No changes recorded — Re-read/);
    assert.ok(got.scroll <= got.client + 1, `the row's content (${got.scroll}) fits its width (${got.client})`);
    assert.ok(got.docScroll <= got.view, 'the page does not scroll sideways');
    assert.ok(got.inside, 'the badge is inside the row');
    assert.ok(got.h >= 40, `a touch-sized button (${got.h}px)`);
    await page.click('[data-unrecorded]');
    assert.equal(await page.evaluate(() => document.body.dataset.reread), '1', 'clicking asks for the Re-read');
    await page.close();
  });
}
