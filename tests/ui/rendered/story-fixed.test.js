// Rendered check: the Story tab keeps the mock's fixed values (switch, plan bar, pulse die, tags, agenda links) in both themes.
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

/** Runs in the page: reads the Story values the mock fixes (computed, so a later rule cannot hide a miss). */
function read() {
  const root = document.getElementById('hx-frame');
  const css = (el) => getComputedStyle(el);
  const rect = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; };
  const q = (s) => root.querySelector(s);
  const sw = q('.story-tab .sw');
  const tags = [...root.querySelectorAll('.it2 .h .tagx')];
  const link = q('.it2 p a');
  return {
    tabFont: [css(q('.story-tab')).fontSize, css(q('.story-tab')).lineHeight],
    spobtn: { bg: css(q('.spobtn')).backgroundColor, border: css(q('.spobtn')).borderTopColor, width: css(q('.spobtn')).borderTopWidth },
    barSmall: css(q('.spobar small')).fontSize,
    wsegRadius: css(q('.story-tab .wseg')).borderRadius,
    die: { border: css(q('.die')).borderTopWidth, size: rect(q('.die')) },
    switchBox: rect(sw), switchMargin: css(sw).margin, switchPill: getComputedStyle(sw, '::before').width + ' ' + getComputedStyle(sw, '::before').height, switchThumb: getComputedStyle(sw, '::after').width,
    tags: tags.map((t) => css(t).color + '|' + css(t).backgroundColor),
    link: link ? { minHeight: css(link).minHeight, display: css(link).display, hasAvatar: Boolean(link.querySelector('.av')) } : null,
    rowGap: q('.more-list') ? css(q('.more-list')).rowGap : null,
    footTop: q('.more-foot') ? css(q('.more-foot')).marginTop : null,
    gridCols: css(q('.dgrid2')).gridTemplateColumns.split(' ').length,
    castSmall: css(q('.castn small')).lineHeight,
  };
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
  if (ctx?.server) await new Promise((done) => ctx.server.close(done));
});

async function measure(theme, width, plan) {
  const page = await ctx.browser.newPage({ viewport: { width, height: 1000 } });
  try {
    await page.goto(`http://127.0.0.1:${ctx.port}/ui/dev/harness.html?theme=${theme}&width=${width}&tab=story&plan=${plan}`);
    await page.waitForSelector('#hx-frame .story-tab .spobtn');
    // story.css only: the die's 2px border is set nowhere else, so this waits until the sheet has applied.
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#hx-frame .die')).borderTopWidth === '2px');
    return await page.evaluate(read);
  } finally { await page.close(); }
}

for (const theme of ['dark', 'light']) {
  test(`Story plan hidden keeps the mock's bar, die and switch in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const s = await measure(theme, 390, 'off');
    assert.deepEqual(s.tabFont, ['14px', '21px']);
    assert.deepEqual(s.spobtn, { bg: 'rgba(240, 184, 74, 0.12)', border: 'rgba(240, 184, 74, 0.55)', width: '1px' });
    assert.equal(s.barSmall, '12.75px');
    assert.equal(s.wsegRadius, '22px');
    assert.deepEqual(s.die, { border: '2px', size: [52, 52] });
    assert.deepEqual(s.switchBox, [62, 46]);
    assert.equal(s.switchMargin, '-10px -4px');
    assert.equal(s.switchPill, '54px 26px');
    assert.equal(s.switchThumb, '18px');
    assert.equal(s.castSmall, 'normal');
  });

  test(`Story plan shown keeps the mock's tags, agenda links and gaps in ${theme}`, async (t) => {
    if (ctx.skip) return t.skip(ctx.skip);
    const s = await measure(theme, 390, 'on');
    assert.ok(s.tags.length >= 8);
    assert.equal(new Set(s.tags).size, 1, `every tag is the same soft pill: ${[...new Set(s.tags)].join(' / ')}`);
    assert.deepEqual(s.link, { minHeight: '0px', display: 'inline', hasAvatar: true });
    assert.equal(s.rowGap, '8px');
    assert.equal(s.footTop, '0px');
  });
}

test('Story Director cards share a row at tablet width', async (t) => {
  if (ctx.skip) return t.skip(ctx.skip);
  assert.equal((await measure('dark', 820, 'off')).gridCols, 2);
  assert.equal((await measure('dark', 390, 'off')).gridCols, 1);
});
