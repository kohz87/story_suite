// Settings › Tools › Prompts on a live host (owner 18 Nov: "cannot edit prompt"): each People prompt and the arc planner prompt can be read, changed
// and put back, through the real selectors and port; the text is stored where the engine reads it, the prompt the engine builds carries it, and it reads back after a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { DEFAULT_BEHAVIOR_CRITERIA, DEFAULT_IMPACT_CRITERIA, DEFAULT_MEMORY_CRITERIA, DEFAULT_RELATIONSHIP_CRITERIA } from '../../../modules/people/core/core-prompts-criteria.js';
import { buildScannerPrompt } from '../../../modules/people/core/core-prompts-scanner.js';
import { compactInjectionBehaviorRubric } from '../../../modules/people/core/core-injection-parts.js';
import { DEFAULT_PLANNER_PROMPT, plannerRequest } from '../../../modules/arc/plan.js';
import { arcSettings } from '../../../modules/arc/settings-parts/read.js';

const NPC = 'npc-state-delta';
const settled = () => new Promise(resolve => setTimeout(resolve, 0));

async function live(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  const port = createSbPort({ sdk: host.sdk, writes: { settings: host.settings, features: host.features }, selectors: buildSelectors(() => null, host.sdk) });
  installFakeDom();
  // `open()` draws Settings as the ⚙ does: a fresh overlay reading the stored values again (a reload)
  const open = () => {
    const doc = globalThis.document;
    const overlay = createSettingsOverlay({
      doc, host: doc.body, settings: port.view('settings'), renderSection: renderSettingsSection,
      onChange: (key, value) => port.command('settings.set', { key, value }), onAction: (key, value) => port.command('settings.action', { key, value }), onView: (name, args) => port.view(name, args),
    });
    overlay.open('tools');
    const row = id => overlay.el.querySelector(`.srow[data-key="tools.prompt.${id}"]`);
    const button = (el, label) => el.querySelectorAll('button').find(b => b.textContent === label);
    const box = id => overlay.el.querySelector(`.srow[data-key="tools.prompt.${id}.edit"] textarea`);
    const edit = async (id, text) => {
      button(row(id), 'Read and edit').click();
      const el = box(id);
      el.value = text;
      el.dispatch('input');
      button(overlay.el.querySelector(`.srow[data-key="tools.prompt.${id}.edit"]`), 'Save').click();
      await settled(); await settled();
    };
    const reset = async id => { button(row(id), 'Reset to default').click(); await settled(); await settled(); };
    return { overlay, row, box, button, edit, reset };
  };
  return { host, open, people: () => host.sdk.settings(NPC), director: () => host.sdk.settings('story-director') };
}

test('the Prompts card lists the four People prompts and the arc planner prompt, each opening on the text the engine sends now', async t => {
  const { open } = await live(t);
  const { overlay, row, box, button } = open();
  const card = overlay.el.querySelector('[data-card="prompts"]');
  assert.ok(card, 'the Prompts card is drawn on the live Tools page');
  assert.deepEqual(card.querySelectorAll('.srow b').map(b => b.textContent),
    ['People: how feelings are judged', 'People: how big a moment is', 'People: what is worth remembering', 'People: feelings into behaviour', 'Arc planner prompt']);
  for (const id of ['feelings', 'moments', 'memories', 'behaviour', 'arc']) assert.ok(button(row(id), 'Reset to default').hasAttribute('disabled'), `${id}: nothing to reset yet`);
  button(row('arc'), 'Read and edit').click();
  assert.equal(box('arc').value, DEFAULT_PLANNER_PROMPT);
  button(row('behaviour'), 'Read and edit').click();
  assert.equal(box('behaviour').value, DEFAULT_BEHAVIOR_CRITERIA);
  assert.equal(box('behaviour').getAttribute('maxlength'), '20000', 'the box takes no more than is kept');
  assert.equal(box('arc'), null, 'one box open at a time');
});

test('a People prompt saved here is stored where People reads it, changes the prompt People builds, and Reset puts the built-in text back', async t => {
  const { open, people } = await live(t);
  const page = open();
  await page.edit('feelings', 'Trust only moves on kept promises.');
  await page.edit('moments', 'Only a death is extreme.');
  await page.edit('memories', 'Remember every gift.');
  await page.edit('behaviour', 'High Tension means short answers.');
  let s = people();
  assert.deepEqual([s.relationshipCriteria, s.relationshipImpactCriteria, s.memoryCriteria, s.behaviorCriteria],
    ['Trust only moves on kept promises.', 'Only a death is extreme.', 'Remember every gift.', 'High Tension means short answers.']);
  const prompt = buildScannerPrompt({ transcript: 'x', relationshipCriteria: s.relationshipCriteria, impactCriteria: s.relationshipImpactCriteria, memoryCriteria: s.memoryCriteria });
  for (const text of ['Trust only moves on kept promises.', 'Only a death is extreme.', 'Remember every gift.']) assert.ok(prompt.includes(text), text);
  assert.ok(compactInjectionBehaviorRubric(s.behaviorCriteria, 4000).includes('High Tension means short answers.'));
  page.overlay.destroy();
  const again = open();
  assert.match(again.row('feelings').querySelector('small').textContent, /your own text/);
  again.button(again.row('feelings'), 'Read and edit').click();
  assert.equal(again.box('feelings').value, 'Trust only moves on kept promises.', 'reads back after a reload');
  for (const id of ['feelings', 'moments', 'memories', 'behaviour']) await again.reset(id);
  s = people();
  assert.deepEqual([s.relationshipCriteria, s.relationshipImpactCriteria, s.memoryCriteria, s.behaviorCriteria],
    [DEFAULT_RELATIONSHIP_CRITERIA, DEFAULT_IMPACT_CRITERIA, DEFAULT_MEMORY_CRITERIA, DEFAULT_BEHAVIOR_CRITERIA]);
  assert.ok(!buildScannerPrompt({ transcript: 'x', relationshipCriteria: s.relationshipCriteria }).includes('Trust only moves on kept promises.'));
});

test('the arc planner prompt saved here is what the planner is asked; Reset stores the default the old editor stored', async t => {
  const { open, director } = await live(t);
  const page = open();
  await page.edit('arc', 'Plan a heist in three beats for {{user}}.');
  assert.equal(director()['arc.prompt'], 'Plan a heist in three beats for {{user}}.');
  const asked = plannerRequest({ template: arcSettings(director()).prompt });
  assert.ok(asked.system.includes('Plan a heist in three beats for {{user}}.'));
  assert.ok(!asked.system.includes(DEFAULT_PLANNER_PROMPT.slice(0, 80)));
  page.overlay.destroy();
  const again = open();
  again.button(again.row('arc'), 'Read and edit').click();
  assert.equal(again.box('arc').value, 'Plan a heist in three beats for {{user}}.');
  await again.reset('arc');
  assert.equal(director()['arc.prompt'], '');
  assert.deepEqual(plannerRequest({ template: arcSettings(director()).prompt }), plannerRequest({}));
  // the default text saved as is stays the default (stored ''), as the old editor did
  await again.edit('arc', DEFAULT_PLANNER_PROMPT);
  assert.equal(director()['arc.prompt'], '');
});
