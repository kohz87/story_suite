// Rendered check: text on an accent fill (a selected Settings segment such as Look's "Glass" or "Normal", the primary button, the Journal's today,
// the World leg number) reads at WCAG AA (4.5:1) in Glass dark, Glass light and with SillyTavern's own colours, and carries no glow:
// SillyTavern gives every element `text-shadow` in its shadow colour, which smeared the dark text on the owner's blue accent (18 Nov).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
// SillyTavern's own rule (public/style.css `*`), with the shadow its default themes use; it loads before the suite's sheets.
const ST_GLOW = '* { text-shadow: 0px 0px calc(var(--shadowWidth) * 1px) var(--SmartThemeShadowColor); }';
// The owner's theme (quote colour sampled from the 18 Nov screenshot) and a dark violet quote colour, where white text reads better.
const ST_THEMES = {
  'st-blue': { '--SmartThemeQuoteColor': 'rgb(81, 160, 222)', '--SmartThemeBodyColor': 'rgb(220, 220, 210)', '--SmartThemeBlurTintColor': 'rgba(23, 23, 23, 0.9)', '--SmartThemeShadowColor': 'rgba(0, 0, 0, 1)', '--shadowWidth': '2' },
  'st-violet': { '--SmartThemeQuoteColor': 'rgb(96, 40, 150)', '--SmartThemeBodyColor': 'rgb(220, 220, 210)', '--SmartThemeBlurTintColor': 'rgba(23, 23, 23, 0.9)', '--SmartThemeShadowColor': 'rgba(0, 0, 0, 1)', '--shadowWidth': '2' },
};
const GLASS = { '--SmartThemeShadowColor': 'rgba(0, 0, 0, 1)', '--shadowWidth': '2' };

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

/** Runs in the page: every element drawn on the accent fill with text of its own (or a child's), its contrast and its text-shadow. */
function scan() {
  const root = document.querySelector('.su-root');
  const probe = document.createElement('i');
  probe.style.background = 'var(--su-accent)';
  root.appendChild(probe);
  const accent = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => [r, g, b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const out = [];
  for (const el of root.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.backgroundColor !== accent || !el.getBoundingClientRect().width) continue;
    const texts = [el, ...el.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    for (const t of texts) {
      const tc = getComputedStyle(t);
      const fg = rgba(tc.color);
      const bg = rgba(accent);
      out.push({ text: t.textContent.trim().slice(0, 30), cls: el.className, ratio: Math.round(ratio(fg, bg) * 100) / 100, shadow: tc.textShadow });
    }
  }
  return out;
}

async function openPage(theme, vars, width) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=journal`);
  await page.waitForSelector('#hx-frame .su-root');
  await page.evaluate(({ glow, vars }) => {
    const style = document.createElement('style');
    style.textContent = glow;
    document.head.prepend(style);
    for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  }, { glow: ST_GLOW, vars });
  if (theme === 'follow') await page.click('[data-key="theme"][data-value="follow"]');
  return page;
}

const CASES = [['dark', 'dark', GLASS], ['light', 'light', GLASS], ['st-blue', 'follow', ST_THEMES['st-blue']], ['st-violet', 'follow', ST_THEMES['st-violet']]];
for (const [name, theme, vars] of CASES) {
  for (const width of [390, 1280]) {
    test(`text on the accent at ${width} in ${name}: 4.5:1 or better and no glow (Settings › Look, Journal, World)`, async t => {
      if (ctx.skip) return t.skip(ctx.skip);
      const page = await openPage(theme, vars, width);
      try {
        const found = [];
        await page.waitForSelector('#hx-frame .journal-tab');
        found.push(...await page.evaluate(scan));
        await page.click(width >= 600 ? '#hx-frame .su-strip [data-tab="world"]' : '#hx-frame .su-bar [data-tab="world"]');
        await page.waitForSelector('#hx-frame .world-tab');
        found.push(...await page.evaluate(scan));
        await page.click('#hx-frame .ctop .ibtn');
        await page.waitForSelector('#hx-frame .sov:not([hidden])');
        if (width < 600) await page.click('#hx-frame .phonelist [data-sec="look"]');
        else await page.click('#hx-frame .snav [data-sec="look"]');
        await page.waitForSelector('#hx-frame .sov .sseg2 [aria-pressed="true"]');
        const look = await page.evaluate(scan);
        assert.ok(look.some(f => f.text.startsWith('Glass')), `Look's selected Panel style is on the accent: ${JSON.stringify(look)}`);
        found.push(...look);
        for (const f of found) {
          assert.ok(f.ratio >= 4.5, `"${f.text}" (${f.cls}) is ${f.ratio}:1 on the accent`);
          assert.equal(f.shadow, 'none', `"${f.text}" (${f.cls}) keeps a glow`);
        }
      } finally { await page.close(); }
    });
  }
}
