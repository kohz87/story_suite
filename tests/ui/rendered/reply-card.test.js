// Rendered check of the card under each reply (ui/chat/reply-box.js) as SillyTavern hosts it: at phone and desktop widths nothing overflows, line 2
// keeps one row, the tabs are equal, 44 / 42 px high and at least 84 / 96 px wide with their words centred, line 1 never runs under the corner
// button, a phone's actions are full width, and on the latest reply no part of the card meets SillyTavern's swipe arrows and counter (its default
// layout, "hide chat avatars" and the Moonlit Echoes theme, inlined below as the old row's check measured them in the replica on 18 Nov).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
const ST = `
:root{--SmartThemeBodyColor:#ddd;--SmartThemeEmColor:#999;--SmartThemeBorderColor:#444;--SmartThemeBlurTintColor:#222;--SmartThemeChatTintColor:#111;--SmartThemeBotMesBlurTintColor:#2a2a2a;--SmartThemeShadowColor:#0006;--SmartThemeUnderlineColor:#c44;--SmartThemeQuoteColor:#a897ff}
*{box-sizing:border-box}body{margin:0;background:#111;color:#ddd;font:15px sans-serif}#chat{margin:0 auto}
.drawer,.card,.tabs,.row,.bar{display:flex;flex-flow:row;width:100%}
.mes{display:flex;align-items:flex-start;padding:10px 10px 0 10px;width:100%;position:relative;--swipeCounterHeight:15px;--swipeCounterMargin:5px}
.mesAvatarWrapper{width:50px;flex:none;height:50px}.mes_block{padding-top:0;padding-left:10px;width:100%;overflow-x:hidden;overflow-y:clip}
.mes_text{padding:5px 30px 5px 0}
.swipe_right,.swipe_left{width:25px;height:25px;font-size:20px;display:flex;align-items:center;justify-content:center}
.swipe_left{position:absolute;bottom:calc(var(--swipeCounterHeight) + var(--swipeCounterMargin));right:auto;left:20px}
.swipeRightBlock{position:absolute;right:0;bottom:0;display:flex;flex-flow:column;align-items:center}
.swipes-counter{font-size:12px;padding:0 5px;min-width:40px;display:flex;justify-content:center;margin-bottom:var(--swipeCounterMargin);height:var(--swipeCounterHeight)}
body.hideChatAvatars .mesAvatarWrapper{display:none}body.hideChatAvatars .last_mes{padding-bottom:20px!important}body.hideChatAvatars .swipe_left{left:7px}
body.moonlit .mes{padding:10px 0}body.moonlit .mes_block{padding:14.7px 14.7px 25px}body.moonlit .mes_text{padding:5px 0 10px}
body.moonlit .swipeRightBlock{flex-direction:row-reverse;justify-content:flex-end;right:14.7px;bottom:20px;height:25px}
body.moonlit .swipes-counter{width:60px;margin:0 10px 2px 0;white-space:nowrap}body.moonlit .swipe_left{left:auto;right:120px;bottom:20px}
body.moonlit.narrow .swipe_left,body.moonlit.narrow .swipeRightBlock{bottom:30px!important}`;
const STYLES = ['base', 'shell', 'kit', 'card', 'now', 'chat', 'loot', 'party', 'bag', 'fight', 'people', 'dossier', 'world', 'journal', 'story', 'settings'];
const mes = (id, text, last = false) => `<div class="mes${last ? ' last_mes' : ''}" mesid="${id}"><div class="mesAvatarWrapper"></div>${last ? '<div class="swipe_left">‹</div>' : ''}<div class="mes_block"><div class="mes_text">${text}</div></div>${last ? '<div class="swipeRightBlock"><div class="swipe_right">›</div><div class="swipes-counter">1/1</div></div>' : ''}</div>`;
/** The page: an older reply, the reader's message and the newest reply; `?v=` full (default), empty (nothing known yet), fight, loot, badge; `&open=` a tab on the newest. */
const PAGE = `<!doctype html><meta charset="utf-8"><style>${ST}</style>${STYLES.map(n => `<link rel="stylesheet" href="/ui/css/${n}.css">`).join('')}
<div id="chat">${mes(1, 'Two hundred paces shy of the weathered mile-marker, dark shapes moved low in the drainage ditch.')}<div class="mes user" mesid="2"><div class="mes_block"><div class="mes_text">I count the ears.</div></div></div>${mes(3, 'Pella counted the ears twice against her thumb before she unlocked the strongbox.', true)}</div>
<script type="module">
import { fixture } from '/ui/fixtures/index.js';
import { createChatSurfaces } from '/ui/chat/chat-surfaces.js';
const q = new URLSearchParams(location.search), v = q.get('v') || 'full';
if (q.get('chat')) document.getElementById('chat').style.width = q.get('chat') + 'vw'; // (SillyTavern's chat column: Chat Width, 50 by default, 60 in the owner's replica)
const chat = fixture(v === 'fight' ? { fightOpen: true, rpg: true } : { rpg: true }).chat;
const newest = chat.replies[1];
newest.top.place = 'Bluewatch Village · Guild Office, by the notice board';
newest.top.condition = 'bandaged hound bite on the left forearm, rat bites on both shins';
if (v === 'empty') { chat.replies = [{ index: 3, top: { date: '', time: '6:00 am', place: '', weather: null, pools: [], condition: null }, changes: [], chatter: [], here: [], choices: [] }]; chat.head.actions = { fight: false, loot: [], points: null, overdue: null, joins: [], offers: 0, unrecorded: false }; }
if (v === 'loot' || v === 'fight') chat.head.actions.loot = [{ sid: 'shot-1', where: 'in the spilled barley', taken: false, items: [{ at: 0, label: 'rat tails ×12' }, { at: 1, label: 'torn grain sack' }, { at: 2, label: 'a brass ring' }] }];
if (v === 'badge') chat.head.actions = { ...chat.head.actions, unrecorded: true, joins: ['Mara'], offers: 1 };
const surfaces = createChatSurfaces({ messagesEl: document.getElementById('chat'), handlers: { onReread: () => {} } });
surfaces.refresh(chat);
const open = q.get('open');
if (open) document.querySelector('.ssrc.newest [data-tab="' + open + '"]')?.click();
if (v === 'loot' || v === 'fight') document.querySelector('.ssrc [data-loot]')?.click();
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

async function open(width, query = '') {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
  await page.route('**/*', route => (route.request().url().startsWith(`http://127.0.0.1:${ctx.port}/`) ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${ctx.port}/chat.html${query}`);
  await page.waitForSelector('body[data-ready="1"] .ssrc');
  return page;
}

// Runs in the page: what the card's layout rules promise, measured.
function measure() {
  const r = e => e.getBoundingClientRect();
  const card = document.querySelector('.ssrc.newest');
  const box = r(card);
  const inside = [...card.querySelectorAll('*')].filter(e => r(e).width && getComputedStyle(e).position !== 'absolute' && !e.closest('.ts')).filter(e => r(e).right > box.right + 0.5 || r(e).left < box.left - 0.5).map(e => e.className || e.tagName);
  const tabs = [...card.querySelectorAll('.tb')].map(e => ({ w: r(e).width, h: r(e).height, lb: r(e.querySelector('.lb')), self: r(e) }));
  const centred = tabs.every(t => Math.abs((t.lb.top + t.lb.bottom) / 2 - (t.self.top + t.self.bottom) / 2) < 2.5);
  const pools = [...card.querySelectorAll('.ssrc-l2 .vb')].map(e => Math.round(r(e).top));
  const corner = r(card.querySelector('.cnr'));
  const l1 = [...card.querySelectorAll('.ssrc-l1 .it')].map(r);
  const under = l1.some(a => a.left < corner.right && corner.left < a.right && a.top < corner.bottom && corner.top < a.bottom);
  const acts = [...card.querySelectorAll('.ssrc-acts .ab')].map(e => Math.round(r(e).width));
  const actsRow = card.querySelector('.ssrc-acts .row');
  const column = r(card).width;
  return {
    inside, pageOverflow: document.scrollingElement.scrollWidth - innerWidth, cardOverflow: card.scrollWidth - card.clientWidth, tabs: tabs.map(t => [Math.round(t.w), Math.round(t.h)]), centred,
    column, poolRows: new Set(pools).size, under, acts, actsW: actsRow ? Math.round(r(actsRow).width - parseFloat(getComputedStyle(actsRow).paddingLeft) - parseFloat(getComputedStyle(actsRow).paddingRight)) : 0,
    condition: card.querySelector('.ssrc-l3')?.textContent ?? '', older: document.querySelectorAll('.ssrc').length, olderCorner: document.querySelectorAll('.ssrc:not(.newest) .cnr').length,
  };
}

for (const [width, chat] of [[390, 0], [1143, 0], [1280, 0], [1143, 50], [1280, 60], [1920, 50]]) {
  for (const v of ['full', 'fight', 'badge']) {
    test(`${width}px${chat ? ` (chat column ${chat}%)` : ''} (${v}): the card fits, line 2 is one row, the tabs are equal and centred, line 1 clears the corner`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await open(width, `?v=${v}&open=here${chat ? `&chat=${chat}` : ''}`);
      try {
        const g = await page.evaluate(measure);
        // (the layout follows the reply column: under 600 px the narrow rules, under 480 px the phone's full-width actions)
        const phone = g.column < 600;
        assert.deepEqual(g.inside, [], 'nothing past the card\'s edges');
        assert.ok(g.pageOverflow <= 0, `the page does not scroll sideways (${g.pageOverflow})`);
        assert.equal(g.poolRows, 1, 'HP · MP · SP keep one row');
        assert.equal(g.under, false, 'line 1 wraps under the corner button, never under it');
        assert.equal(g.older, 2, 'a card under each reply');
        assert.equal(g.olderCorner, 0, 'the corner is the newest card\'s only');
        assert.match(g.condition, /rat bites on both shins$/u, 'the condition whole');
        assert.ok(g.centred, 'tab words centred');
        const widths = new Set(g.tabs.map(([w]) => w));
        assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, `equal tabs: ${JSON.stringify(g.tabs)}`);
        for (const [w, h] of g.tabs) {
          assert.ok(w >= (phone ? 84 : 96) - 0.5, `tab width ${w}`);
          assert.equal(h, phone ? 44 : 42);
        }
        if (g.column < 480) for (const w of g.acts) assert.ok(Math.abs(w - g.actsW) <= 1, `a phone's action is full width (${w} of ${g.actsW})`);
      } finally { await page.close(); }
    });
  }
}

test('the newest card and its open Pick up clear SillyTavern\'s swipe arrows and counter at every width, in every layout', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  for (const v of ['empty', 'loot']) for (const width of [390, 1143, 1280, 1920]) {
    const page = await open(width, `?v=${v}`);
    try {
      for (const mode of ['default', 'hideChatAvatars', 'moonlit', 'moonlit narrow']) {
        await page.evaluate(m => { document.body.className = m === 'default' ? '' : m; }, mode);
        for (const count of ['1/1', '123/456']) {
          await page.evaluate(text => { document.querySelector('.swipes-counter').textContent = text; }, count);
          const out = await page.evaluate(() => {
            const last = document.querySelector('#chat .mes.last_mes');
            const rect = e => e.getBoundingClientRect();
            const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
            const band = ['.swipe_left', '.swipe_right', '.swipes-counter'].map(s => [s, rect(last.querySelector(s))]);
            const card = rect(last.querySelector('.ssrc'));
            return band.filter(([, r]) => meet(card, r)).map(([name]) => name);
          });
          assert.deepEqual(out, [], `${v} ${width} ${mode} ${count}: the card meets ${out.join(', ')}`);
        }
      }
    } finally { await page.close(); }
  }
});

test('the strip swipes sideways with no scrollbar and fades at the edge while more tabs lie past it', async t => {
  if (ctx.skip) return t.skip(ctx.skip);
  const page = await open(320);
  try {
    const g = await page.evaluate(async () => {
      const strip = document.querySelector('.ssrc.newest .ts');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const before = strip.parentElement.classList.contains('more');
      const cs = getComputedStyle(strip);
      const bar = strip.offsetHeight - strip.clientHeight - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      strip.scrollLeft = strip.scrollWidth;
      strip.dispatchEvent(new Event('scroll'));
      return { more: strip.scrollWidth > strip.clientWidth, before, after: strip.parentElement.classList.contains('more'), bar, snap: getComputedStyle(strip).scrollSnapType };
    });
    assert.equal(g.more, true, 'four tabs at 84 px do not fit a 320 px chat');
    assert.equal(g.before, true, 'the fade shows');
    assert.equal(g.after, false, 'scrolled to the end: no fade');
    assert.equal(g.bar, 0, 'no scrollbar');
    assert.match(g.snap, /x/u);
  } finally { await page.close(); }
});
