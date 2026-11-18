// One browser page on a running SillyTavern for the settings walk: load it, open a chat and the suite, force dark or light, open Settings and its pages, and reload once the saves have landed.
import { listControls, readValues, lookPrint, storeSnapshot } from './walk-dom.mjs';

// SillyTavern's theme colours that the suite's Follow SillyTavern reads to choose dark or light (ui/theme/follow-st.js).
const THEMES = { dark: ['#e6e6ee', 'rgba(22, 22, 30, 0.92)'], light: ['#1c1c24', 'rgba(250, 250, 252, 0.92)'] };
// Anything that could reach a model is refused, whatever the replica's connection says.
const MODEL_CALLS = /\/api\/(backends\/[^/]+\/(generate|status)|openai\/|novelai\/|horde\/|sd\/|tts\/|translate\/|extra\/)/;
const SAVES = /\/api\/(settings\/save|chats\/save|chats\/group\/save)/;
const CLICK = { timeout: 20000 };
const OPEN = '.sov:not([hidden])';

/**
 * Opens a page at `size` ({ w, h }) in `theme` ('dark' | 'light'). `character` names the character whose last chat is opened
 * (default: the one chatted with most recently). Returns the session's steps; each throws with a plain message when the page does not do it.
 */
export async function createSession({ browser, url, size, theme, character = null }) {
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
  const page = await context.newPage();
  const errors = [];
  let inflight = 0;
  let lastSave = 0;
  let lastChange = 0;
  let name = character;
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.route(MODEL_CALLS, route => route.abort());
  page.on('request', (r) => { if (SAVES.test(r.url())) { inflight += 1; lastSave = Date.now(); } });
  const done = (r) => { if (SAVES.test(r.url())) { inflight = Math.max(0, inflight - 1); lastSave = Date.now(); } };
  page.on('requestfinished', done);
  page.on('requestfailed', done);

  async function forceTheme() {
    await page.evaluate(([body, tint]) => {
      const style = document.documentElement.style;
      style.setProperty('--SmartThemeBodyColor', body);
      style.setProperty('--SmartThemeBlurTintColor', tint);
    }, THEMES[theme]);
    await page.waitForFunction(want => document.querySelector('.su-root')?.dataset.scheme === want, theme, { timeout: 15000 })
      .catch(() => { throw new Error(`the suite did not turn ${theme} when SillyTavern's theme colours changed`); });
  }

  async function load(first) {
    if (first) await page.goto(url, { waitUntil: 'domcontentloaded' });
    else await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext?.()?.characters?.length), null, { timeout: 180000 });
    name = await page.evaluate(async (wanted) => {
      const ctx = globalThis.SillyTavern.getContext();
      const list = ctx.characters;
      let at = wanted ? list.findIndex(c => c.name === wanted) : -1;
      if (wanted && at < 0) throw new Error(`no character named ${wanted}`);
      if (at < 0) at = list.reduce((best, c, i) => (Number(c.date_last_chat || 0) > Number(list[best].date_last_chat || 0) ? i : best), 0);
      await ctx.selectCharacterById(at);
      return list[at].name;
    }, name);
    await page.waitForFunction(() => Boolean(globalThis.SillyTavern.getContext().chatId), null, { timeout: 60000 });
    await page.waitForSelector('#story-suite-ui-menu', { state: 'attached', timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.locator('#extensionsMenuButton').click(CLICK);
    await page.locator('#story-suite-ui-menu').click(CLICK);
    await page.waitForSelector('.su-layer[data-state=open]', { timeout: 20000 });
    await forceTheme();
  }

  async function openSettings() {
    await page.locator('.su-root button[aria-label="Settings"]:visible').first().click(CLICK);
    await page.waitForSelector(OPEN, { timeout: 15000 });
  }

  async function closeSettings() {
    await page.locator(`${OPEN} button.x`).click(CLICK);
    await page.waitForSelector(OPEN, { state: 'detached', timeout: 15000 });
  }

  // A page of Settings, by the side list (tablet and desktop) or the phone list; Start opens every module card's features.
  async function gotoSection(id) {
    const side = page.locator(`${OPEN} .snav [data-sec="${id}"]`);
    if (await side.isVisible()) await side.click(CLICK);
    else {
      const back = page.locator(`${OPEN} .sback`);
      if (await back.isVisible()) await back.click(CLICK);
      await page.locator(`${OPEN} .phonelist [data-sec="${id}"]`).click(CLICK);
    }
    await page.waitForTimeout(250);
    if (id !== 'start') return;
    for (let i = 0; i < 8; i += 1) {
      const more = page.locator(`${OPEN} .spage button.lnk`, { hasText: /^Features/ });
      if (!(await more.count())) break;
      await more.first().click(CLICK);
    }
  }

  // Waits until no save request is open and none came for a while after the last change.
  async function settle() {
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      const now = Date.now();
      if (inflight === 0 && now - lastChange > 3000 && now - lastSave > 1200) return true;
      await page.waitForTimeout(250);
    }
    return false;
  }

  // Changes one control the way a person does: a click, a pick, or typing and leaving the box.
  async function set(control, to, from) {
    const el = page.locator(`${OPEN} .spage [data-walk-id="${control.id.replace(/["\\]/g, '\\$&')}"]`);
    if (control.kind === 'sw') await el.click(CLICK);
    else if (control.kind === 'seg') await el.locator(`button[data-value="${String(to).replace(/["\\]/g, '\\$&')}"]`).click(CLICK);
    else if (control.kind === 'sel') await el.selectOption(String(to), CLICK);
    else if (control.kind === 'num' || control.kind === 'txt') { await el.fill(String(to), CLICK); await el.press('Tab', CLICK); }
    else if (control.kind === 'chips') {
      const a = new Set(String(from ?? '').split(', ').filter(Boolean));
      const b = new Set(String(to ?? '').split(', ').filter(Boolean));
      for (const chip of control.options) if (a.has(chip) !== b.has(chip)) await el.getByRole('button', { name: chip, exact: true }).click(CLICK);
    }
    lastChange = Date.now();
    await page.waitForTimeout(300);
  }

  return {
    page,
    errors,
    character: () => name,
    boot: () => load(true),
    async reload() { const saved = await settle(); await load(false); return saved; },
    openSettings,
    closeSettings,
    gotoSection,
    async reopenAt(id) { await closeSettings(); await openSettings(); await gotoSection(id); },
    sections: () => page.evaluate(() => [...new Set([...document.querySelectorAll('.sov:not([hidden]) .snav [data-sec]')].map(e => e.dataset.sec))]),
    controls: () => page.evaluate(listControls),
    values: () => page.evaluate(readValues),
    look: () => page.evaluate(lookPrint),
    store: () => page.evaluate(storeSnapshot),
    set,
    settle,
    shot: path => page.screenshot({ path }).catch(() => null),
    // Last resort after a walk that stopped half-way: writes the suite's stored settings and device keys back from a snapshot and reloads.
    async rescue(snapshot) {
      await page.evaluate((snap) => {
        const ctx = globalThis.SillyTavern.getContext();
        for (const [key, value] of Object.entries(snap.settings ?? {})) ctx.extensionSettings[key] = value;
        for (const [key, value] of Object.entries(snap.device ?? {})) localStorage.setItem(key, value);
        ctx.saveSettingsDebounced();
      }, snapshot);
      lastChange = Date.now();
      return this.reload();
    },
    close: () => context.close(),
  };
}
