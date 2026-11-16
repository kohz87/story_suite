// Rendered check: the chat row and people drawer, drawn the way SillyTavern hosts them (reply column + drawer host, every suite stylesheet loaded).
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
createChatSurfaces({ messagesEl: document.getElementById('chat'), drawerHost: host, isNarrow: () => innerWidth < 600 }).refresh(fixture().chat);
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

async function measure(width) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/chat.html`);
  await page.waitForSelector('body[data-ready] .ssdrawer .pc2');
  const got = await page.evaluate(() => {
    const cs = s => getComputedStyle(document.querySelector(s));
    const tops = [...document.querySelectorAll('.pc2')].map(e => Math.round(e.getBoundingClientRect().top));
    const widths = [...document.querySelectorAll('.pc2')].map(e => Math.round(e.getBoundingClientRect().width));
    return {
      rowDisplay: cs('.ssrow').display, ring: cs('.rg2').width, drawerDisplay: cs('.ssdrawer').display,
      pcrowWrap: cs('.pcrow').flexWrap, sameLine: new Set(tops).size === 1, cards: tops.length, cardW: widths[0], hostW: document.querySelector('.ss-drawer-host').getBoundingClientRect().width,
      faceW: cs('.dhd .mface').width, faceML: cs('.dhd .mface:nth-child(2)').marginLeft, ph: cs('.rg2 .ph').backgroundColor,
    };
  });
  await page.close();
  return got;
}

test('phone width: the row folds to two lines, rings are 60px, two cards share one line', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const g = await measure(390);
  assert.equal(g.rowDisplay, 'block');
  assert.equal(g.ring, '60px');
  assert.equal(g.drawerDisplay, 'block', 'SillyTavern styles .drawer as a flex row; the suite class must not match it');
  assert.equal(g.cards, 2);
  assert.ok(g.sameLine, 'the cards sit side by side');
  assert.ok(g.cardW * 2 < g.hostW && g.cardW > 100, `card width ${g.cardW} fits two across ${g.hostW}`);
  assert.equal(g.pcrowWrap, 'nowrap', 'the Story tab .prow wrap rule must not leak in');
  assert.equal(g.faceW, '22px');
  assert.equal(g.faceML, '-6px', 'the Settings .mf margin must not leak in');
  assert.equal(g.ph, 'rgb(85, 85, 85)');
});

test('tablet width: the row stays on one line, rings are 84px, four cards share one line', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  const g = await measure(820);
  assert.equal(g.rowDisplay, 'flex');
  assert.equal(g.ring, '84px');
  assert.equal(g.cards, 4);
  assert.ok(g.sameLine);
  assert.ok(g.cardW * 4 < Math.min(g.hostW, 700) && g.cardW > 100, `card width ${g.cardW} fits four across ${g.hostW}`);
});
