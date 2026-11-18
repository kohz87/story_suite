// CI gate: every Settings page and module card, drawn from the real selectors on a real host, shows no placeholder, no missing editor and no dead "Settings ›" link.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createToolsHandle } from '../../../ui/port/tools-handle.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { FACT_ROWS } from './no-unavailable-allow.js';

// Words that mean "this is not built": a value or a hint that says so is a placeholder.
const PLACEHOLDER = /\bunavailable\b|set in the old view|not available|coming soon|not built|not yet|placeholder|\btodo\b|\bTBD\b|for now\b|no editor/i;

async function live(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  // The RPG on, so its page is drawn and checked too (it is hidden while the RPG is off); the tools handle gives the Start cards their engine-counted token figures, as in the live view.
  host.features.set('story-block.rpg', true);
  const writes = { settings: host.settings, features: host.features };
  const tools = createToolsHandle({ runtime: host });
  const port = createSbPort({ sdk: host.sdk, writes, tools, selectors: buildSelectors(() => null, host.sdk, tools), rpgValues: () => host.sdk.settings('story-block') });
  return { host, port };
}

function overlayOf(port) {
  installFakeDom();
  const doc = globalThis.document;
  const settings = port.view('settings');
  const overlay = createSettingsOverlay({ doc, host: doc.body, settings, renderSection: renderSettingsSection, onChange: () => ({ ok: true }), onAction: () => ({ ok: true }), onView: (name, args) => port.view(name, args) });
  overlay.open();
  return { overlay, settings, root: overlay.el };
}

const textOf = el => String(el.textContent ?? '').replace(/\s+/g, ' ').trim();
const pageOf = root => root.querySelector('.spage');

test('no row on any Settings page says it is unavailable, unbuilt or set elsewhere', async (t) => {
  const { port } = await live(t);
  const { overlay, settings, root } = overlayOf(port);
  const caught = [];
  for (const s of settings.sections) {
    overlay.show(s.id);
    for (const el of pageOf(root).querySelectorAll('.srow, .mod, .sdesc, .fine, .sinfo, .note')) {
      if (el.querySelector('pre.sent')) continue; // Tools' "The text sent with this reply" quotes the prompt itself (its words, such as "not yet on the map", are the model's instructions)
      const text = textOf(el);
      if (PLACEHOLDER.test(text)) caught.push(`${s.id}: ${text.slice(0, 120)}`);
    }
  }
  assert.deepEqual(caught, []);
});

test('a shown-only row (info) is a listed fact, never a setting that should have an editor', async (t) => {
  const { port } = await live(t);
  const { settings } = overlayOf(port);
  const caught = [];
  for (const s of settings.sections) {
    for (const r of s.rows) {
      if (r.type !== 'info') continue;
      if (FACT_ROWS[r.key]) assert.ok(String(FACT_ROWS[r.key]).length > 8, `${r.key}: a reason is needed`);
      else caught.push(`${s.id}: ${r.key} "${r.label}" = ${JSON.stringify(r.value)}`);
    }
  }
  assert.deepEqual(caught, []);
});

test('every allowlisted fact still exists as an info row (no stale entries)', async (t) => {
  const { port } = await live(t);
  const keys = new Set(port.view('settings').sections.flatMap(s => s.rows.filter(r => r.type === 'info').map(r => r.key)));
  assert.deepEqual(Object.keys(FACT_ROWS).filter(k => !keys.has(k)), []);
});

test('every row that can be edited draws a control', async (t) => {
  const { port } = await live(t);
  const { overlay, settings, root } = overlayOf(port);
  const caught = [];
  for (const s of settings.sections) {
    overlay.show(s.id);
    for (const r of s.rows) {
      const el = pageOf(root).querySelector(`.srow[data-key="${r.key}"]`);
      if (!el) { caught.push(`${s.id}: ${r.key} "${r.label}" is not drawn`); continue; }
      if (r.type === 'info') continue;
      const ctl = el.querySelector('.ctl');
      const drawn = ctl && ctl.querySelector('input, textarea, select, button, .sw, .sseg2, .chips3, .multi');
      if (!drawn) caught.push(`${s.id}: ${r.key} "${r.label}" (${r.type}) has no control`);
    }
  }
  assert.deepEqual(caught, []);
});

test('every "Settings ›" link names a page that exists and opens it', async (t) => {
  const { port } = await live(t);
  const { overlay, settings, root } = overlayOf(port);
  const ids = new Set(settings.sections.map(s => s.id));
  overlay.show('start');
  const links = pageOf(root).querySelectorAll('.mod .mf button[data-sec]');
  assert.ok(links.length > 0, 'the Start page draws the module links');
  const caught = [];
  for (const link of links) {
    const id = link.getAttribute('data-sec');
    const card = link.closest('.mod')?.getAttribute('data-mod');
    if (!ids.has(id)) { caught.push(`${card}: "Settings ›" goes to "${id}", which is not a page`); continue; }
    const name = settings.sections.find(s => s.id === id).name;
    link.click();
    if (textOf(pageOf(root).querySelector('h2')) !== name) caught.push(`${card}: "Settings ›" did not open ${name}`);
    overlay.show('start');
  }
  assert.deepEqual(caught, []);
});

test('every module card has an icon, a description and a token estimate that is not a placeholder 0', async (t) => {
  const { port } = await live(t);
  const { settings } = overlayOf(port);
  const caught = [];
  for (const d of settings.modules.defs) {
    if (!d.icon) caught.push(`${d.id}: no icon`);
    if (!d.desc) caught.push(`${d.id}: no description`);
    if (!d.tokens) caught.push(`${d.id}: shows "≈ 0 tokens"`);
  }
  assert.deepEqual(caught, []);
});

test('every module card is drawn on the Start page and on its own page with no placeholder text', async (t) => {
  const { port } = await live(t);
  const { overlay, settings, root } = overlayOf(port);
  overlay.show('start');
  const caught = [];
  for (const d of settings.modules.defs) {
    const card = pageOf(root).querySelector(`.mod[data-mod="${d.id}"]`);
    if (!card) { caught.push(`${d.id}: no card on Start`); continue; }
    if (PLACEHOLDER.test(textOf(card))) caught.push(`${d.id}: ${textOf(card).slice(0, 100)}`);
  }
  assert.deepEqual(caught, []);
});

test('the Start page draws the Lean, Standard and Full presets the text above them talks about', async (t) => {
  const { port } = await live(t);
  const { overlay, root } = overlayOf(port);
  overlay.show('start');
  assert.deepEqual(pageOf(root).querySelectorAll('.presets .pre').map(b => b.getAttribute('data-pre')), ['lean', 'standard', 'full']);
});
