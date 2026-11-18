// Rendered check (the owner's report, 18 Nov): on the latest reply the Suite button and the rest of the inline row never cover SillyTavern's swipe
// arrows and counter, at any width and any count. SillyTavern is not here in CI, so its own rules for that band are inlined below: its default
// layout (public/style.css), its "hide chat avatars" mode (public/css/toggle-dependent.css), and the Moonlit Echoes theme the owner plays with
// (the left arrow beside the counter, both 20 px up; 30 px on narrow windows), as measured in the replica on 18 Nov.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
const ST = `
:root{--SmartThemeBodyColor:#ddd;--SmartThemeEmColor:#999;--SmartThemeBorderColor:#444;--SmartThemeBlurTintColor:#222;--SmartThemeChatTintColor:#111;--SmartThemeBotMesBlurTintColor:#2a2a2a;--SmartThemeShadowColor:#0006;--SmartThemeUnderlineColor:#c44}
*{box-sizing:border-box}body{margin:0;background:#111;color:#ddd;font:15px sans-serif}#chat{margin:0 auto}
.mes{display:flex;align-items:flex-start;padding:10px 10px 0 10px;width:100%;position:relative;--swipeCounterHeight:15px;--swipeCounterMargin:5px}
.mesAvatarWrapper{width:50px;flex:none;height:50px}.mes_block{padding-top:0;padding-left:10px;width:100%;overflow-x:hidden;overflow-y:clip}
.mes_text{padding:5px 30px 5px 0}
.swipe_right,.swipe_left{width:25px;height:25px;font-size:20px;display:flex;align-items:center;justify-content:center}
.swipe_left{position:absolute;bottom:calc(var(--swipeCounterHeight) + var(--swipeCounterMargin));right:auto;left:20px}
.swipeRightBlock{position:absolute;right:0;bottom:0;display:flex;flex-flow:column;align-items:center}
.swipes-counter{font-size:12px;padding:0 5px;min-width:40px;display:flex;justify-content:center;margin-bottom:var(--swipeCounterMargin);height:var(--swipeCounterHeight)}
.swipe_right{right:5px}
body.hideChatAvatars .mesAvatarWrapper{display:none}body.hideChatAvatars .last_mes{padding-bottom:20px!important}body.hideChatAvatars .swipe_left{left:7px}
body.moonlit .mes{padding:10px 0}body.moonlit .mes_block{padding:14.7px 14.7px 25px}body.moonlit .mes_text{padding:5px 0 10px}
body.moonlit .swipeRightBlock{flex-direction:row-reverse;justify-content:flex-end;right:14.7px;bottom:20px;height:25px}
body.moonlit .swipes-counter{width:60px;margin:0 10px 2px 0;white-space:nowrap}body.moonlit .swipe_left{left:auto;right:120px;bottom:20px}
body.moonlit.narrow .swipe_left,body.moonlit.narrow .swipeRightBlock{bottom:30px!important}`;
const STYLES = ['base', 'chat'];
const PAGE = `<!doctype html><meta charset="utf-8"><style>${ST}</style>${STYLES.map(n => `<link rel="stylesheet" href="/ui/css/${n}.css">`).join('')}
<div id="chat"><div class="mes last_mes"><div class="mesAvatarWrapper"></div><div class="swipe_left">‹</div><div class="mes_block"><div class="mes_text">The clerk taps the page.</div></div>
<div class="swipeRightBlock"><div class="swipe_right">›</div><div class="swipes-counter">1/1</div></div></div></div><div id="send_form"></div>
<script type="module">
import { fixture } from '/ui/fixtures/index.js';
import { createChatSurfaces } from '/ui/chat/chat-surfaces.js';
const host = document.createElement('div'); host.className = 'ss-drawer-host';
document.body.insertBefore(host, document.getElementById('send_form'));
const chat = fixture().chat;
// ?row=empty: the owner's row of 18 Nov, a new chat with nothing known yet (one line: the clock and the Suite button)
if (new URLSearchParams(location.search).get('row') === 'empty') chat.inlineRow = { date: '', time: '', place: '', weather: '', money: null, changes: 0, notApplied: 0, needsYou: { n: 0, title: '' }, fightOpen: false, choices: [] };
createChatSurfaces({ messagesEl: document.getElementById('chat'), drawerHost: host, isNarrow: () => innerWidth < 600 }).refresh(chat);
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

/** Runs in the page: every drawn box of the row (the Suite button first) that meets an arrow or the counter. */
function clashes() {
  const last = document.querySelector('#chat .mes.last_mes');
  const rect = e => e.getBoundingClientRect();
  const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const band = ['.swipe_left', '.swipe_right', '.swipes-counter'].map(s => [s, rect(last.querySelector(s))]);
  const parts = [...last.querySelectorAll('.ssrow .ssbtn, .ssrow .it3, .ssrow button')].filter(e => rect(e).width);
  const out = [];
  for (const el of parts) for (const [name, r] of band) if (meet(rect(el), r)) out.push(`${el.className || el.tagName} meets ${name}`);
  return { out, suite: Boolean(last.querySelector('.ssrow .ssbtn')) };
}

for (const row of ['empty', 'full']) for (const mode of ['default', 'hideChatAvatars', 'moonlit', 'moonlit narrow']) {
  for (const width of [390, 1143, 1280, 1920]) {
    test(`the ${row} inline row clears the swipe arrows and counter at ${width} (${mode})`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`http://127.0.0.1:${ctx.port}/chat.html?row=${row}`);
        await page.waitForSelector('body[data-ready="1"] .ssrow .ssbtn');
        await page.evaluate(m => { for (const c of m.split(' ')) if (c !== 'default') document.body.classList.add(c); }, mode);
        for (const count of ['1/1', '2/3', '123/456']) {
          await page.evaluate(text => { document.querySelector('.swipes-counter').textContent = text; }, count);
          const got = await page.evaluate(clashes);
          assert.equal(got.suite, true);
          assert.deepEqual(got.out, [], `${count}: ${got.out.join('; ')}`);
        }
      } finally { await page.close(); }
    });
  }
}
