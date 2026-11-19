// Rendered check of tools/editor-desk.js (SHB3; mock sheets-desktop.html, frames dossier-edit and dossier-edit-end): from a 1,100 px window NPC State's
// editor is two columns (LEFT "Who they are", RIGHT "With you and now") with the head above the one scrolling body; every field keeps its id; under
// 1,100 px every node is back where editor-refine.js put it, byte for byte. The markup is the refined editor's shape, cut down to its fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = fs.readFileSync(path.join(ROOT, 'modules/people/tools/editor-desk.js'), 'utf8').replace(/^export /m, '');
const CSS = fs.readFileSync(path.join(ROOT, 'modules/people/css/style-editor-desk.css'), 'utf8');

const field = (id, label, tag = 'input') => `<label>${label}${tag === 'textarea' ? `<textarea id="${id}" class="text_pole" rows="4"></textarea>` : tag === 'select' ? `<select id="${id}" class="text_pole"><option>x</option></select>` : `<input id="${id}" class="text_pole">`}</label>`;
const section = (cls, title, inner) => `<section class="delta-editor-section ${cls}"><h4>${title}</h4><div class="delta-editor-section-grid">${inner}</div></section>`;
const HTML = `<dialog class="popup ppl-editor-popup"><div class="popup-body"><div class="popup-content"><div id="people_editor_content" data-npc-id="n1">
  <div class="ppl-editor-head"><div><span class="ppl-kicker">Dossier</span><h3>Edit Temiwa</h3></div></div>
  <p class="ppl-muted">Edits save to this story's NPC State.</p>
  <div class="ppl-editor-grid ppl-editor-profile">${field('people_edit_aliases', 'Aliases', 'textarea')}<label>Faction <small>Custom field</small><input class="text_pole" data-delta-custom-field="Faction"></label>${field('people_edit_level', 'Level')}${field('people_edit_abilities', 'Abilities', 'textarea')}${field('people_edit_keepsakes', 'Keepsakes', 'textarea')}</div>
  <details class="ppl-editor-portrait-overrides"><summary>Portrait prompt overrides</summary></details>
  <div class="ppl-editor-hosted"><label class="ppl-editor-wide">Hidden notes<textarea id="delta_editor_secrets" class="text_pole"></textarea></label></div>
  ${section('delta-editor-identity', 'Identity & profile', ['name', 'species', 'gender', 'role', 'home_base', 'age', 'birthday', 'apparent_age', 'personality', 'behavior_profile', 'speech', 'background']
    .map(id => field(`people_edit_${id}`, id, id === 'gender' ? 'select' : ['personality', 'behavior_profile', 'speech', 'background'].includes(id) ? 'textarea' : 'input')).join(''))}
  ${section('delta-editor-current', 'Current state', ['mood', 'location', 'goal', 'status'].map(id => field(`people_edit_${id}`, id)).join(''))}
  ${section('delta-editor-relationships', 'Relationships', `${field('people_edit_relationship_summary', 'Player Dynamic', 'textarea')}${field('people_edit_key_relationships', 'Key relationships', 'textarea')}<div class="ppl-editor-stats">${['trust', 'affection', 'desire', 'tension'].map(id => field(`people_edit_${id}`, id)).join('')}</div>`)}
  ${section('delta-editor-continuity', 'Continuity', `${field('people_edit_mannerisms', 'Mannerisms', 'textarea')}${field('people_edit_memories', 'Memories', 'textarea')}`)}
  <details class="delta-editor-advanced"><summary>Advanced</summary><div class="delta-editor-advanced-body"><div class="ppl-editor-lifecycle"><b>Lifecycle</b><span>Active</span></div>
    <div class="delta-editor-life-control"><label><span>Life state</span><select class="text_pole" data-delta-life-state><option>Unknown</option></select></label></div>
    <label class="ppl-editor-lock"><input id="people_edit_lock_profile" type="checkbox"> Protect <small>note</small></label><p class="ppl-muted">Currently protected: mood</p>
    <label class="ppl-editor-lock"><input id="people_edit_minor" type="checkbox"> Hide present-NPC card</label></div></details>
</div></div><div class="popup-controls"><div class="popup-button-ok menu_button">Save dossier</div><div class="popup-button-cancel menu_button">Cancel</div></div></div>
<div class="popup-button-close" style="display: none"></div></dialog>`;

let browser = null;
let skip = '';
test.before(async () => {
  try { browser = await (await import('playwright')).chromium.launch(); } catch (err) {
    if (process.env.CI === 'true') throw err;
    skip = `Playwright browser unavailable: ${String(err.message).split('\n')[0]}`;
  }
});
test.after(async () => { await browser?.close(); });

async function mount(width) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head><body>${HTML}</body></html>`);
  await page.addScriptTag({ content: `${SCRIPT}\nglobalThis.fit = fitEditorToWindow;` });
  await page.evaluate(() => { const d = document.querySelector('dialog'); d.showModal(); globalThis.before = d.outerHTML; globalThis.fit(d); });
  return page;
}

const read = () => {
  const d = document.querySelector('dialog');
  const col = c => [...c.querySelectorAll(':scope > *, :scope > .ppl-ed-pair > *, :scope > .ppl-ed-life > *, :scope > .ppl-editor-hosted > *')]
    .filter(e => !e.matches('.ppl-ed-pair, .ppl-ed-life, .ppl-editor-hosted'))
    .map(e => e.querySelector('[id^="people_edit_"], #delta_editor_secrets')?.id ?? e.className.split(' ')[0] ?? e.tagName);
  const cols = [...d.querySelectorAll('.ppl-ed-col')];
  return {
    desk: d.classList.contains('ppl-ed-desk'), width: Math.round(d.getBoundingClientRect().width), left: cols[0] ? col(cols[0]) : [], right: cols[1] ? col(cols[1]) : [],
    heads: cols.map(c => c.querySelector('h4').textContent), headOut: d.querySelector('.popup-content > .ppl-editor-head') !== null,
    xInHead: d.querySelector('.ppl-editor-head .popup-button-close') !== null, ids: [...d.querySelectorAll('[id]')].map(e => e.id).sort(),
    hidden: [...d.querySelectorAll('.delta-editor-section[hidden], .delta-editor-advanced[hidden]')].length, rows: d.querySelector('#people_edit_speech').getAttribute('rows'),
  };
};

test('editor at 1280: 920 px, LEFT who they are, RIGHT with you and now, head and × above the body, ids kept', async (t) => {
  if (skip) return t.skip(skip);
  const page = await mount(1280);
  try {
    const m = await page.evaluate(read);
    assert.equal(m.desk, true);
    assert.equal(m.width, 920);
    assert.deepEqual(m.heads, ['Who they are', 'With you and now']);
    assert.deepEqual(m.left, ['ppl-ed-sec', 'ppl-editor-lifecycle', 'delta-editor-life-control', 'people_edit_name', 'people_edit_species', 'people_edit_gender', 'people_edit_role',
      'people_edit_aliases', 'people_edit_home_base', '', 'people_edit_age', 'people_edit_birthday', 'people_edit_apparent_age', 'people_edit_level',
      'people_edit_abilities', 'people_edit_keepsakes', 'people_edit_key_relationships', 'ppl-editor-portrait-overrides'], 'the custom field (no id) sits after Home Base');
    // (the four numbers' box reads as its first field, Trust)
    assert.deepEqual(m.right, ['ppl-ed-sec', 'people_edit_trust', 'people_edit_relationship_summary', 'people_edit_mood', 'people_edit_location', 'people_edit_status', 'people_edit_goal',
      'people_edit_personality', 'people_edit_behavior_profile', 'people_edit_speech', 'people_edit_background', 'people_edit_mannerisms', 'people_edit_memories', 'delta_editor_secrets',
      'people_edit_lock_profile', 'ppl-muted', 'people_edit_minor']);
    assert.equal(m.headOut, true);
    assert.equal(m.xInHead, true);
    assert.equal(m.hidden, 5, 'the four emptied sections and the Advanced fold are hidden, not removed');
    assert.equal(m.rows, '2');
    assert.deepEqual(m.ids, await page.evaluate(() => [...new DOMParser().parseFromString(globalThis.before, 'text/html').querySelectorAll('[id]')].map(e => e.id).sort()));
  } finally { await page.close(); }
});

test('editor narrowed under 1,100 px: every node goes back, byte for byte; widened again it is two columns', async (t) => {
  if (skip) return t.skip(skip);
  const page = await mount(1280);
  try {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForFunction(() => !document.querySelector('dialog').classList.contains('ppl-ed-desk'));
    assert.equal(await page.evaluate(() => document.querySelector('dialog').outerHTML === globalThis.before), true);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => document.querySelector('dialog').classList.contains('ppl-ed-desk'));
    assert.equal((await page.evaluate(read)).left.length, 18);
  } finally { await page.close(); }
});

test('editor: the appearance section added a frame later lands at the end of the left column', async (t) => {
  if (skip) return t.skip(skip);
  const page = await mount(1280);
  try {
    await page.evaluate(() => {
      const s = document.createElement('section');
      s.className = 'delta-editor-section delta-editor-appearance-forms';
      s.innerHTML = '<h4>Appearance</h4><div class="delta-editor-section-grid"><label>Physical<textarea data-delta-overall-appearance></textarea></label></div>';
      document.querySelector('.delta-editor-identity').after(s);
    });
    await page.waitForFunction(() => document.querySelector('.ppl-ed-col .delta-editor-appearance-forms'));
    assert.equal(await page.evaluate(() => document.querySelector('.ppl-ed-col').lastElementChild.matches('.delta-editor-appearance-forms')), true);
  } finally { await page.close(); }
});
