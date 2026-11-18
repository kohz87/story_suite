// The wizard's Review step in the new view: everything at a glance, what else Create adds, what stops it, and Create itself, which runs
// modules/rpg's create-run.js (the old Review step's commands, in its order). A character made with a block or a thing left out shows that
// sentence and Done; a clean Create closes the sheet. The words are the old step's (modules/rpg/view/wizard/review.js).

import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { moneyText } from '../../modules/rpg/charfile.js';
import { RANKS } from '../../modules/rpg/combat/numbers.js';
import { RANK_NAMES } from '../../modules/rpg/names.js';
import { RPG_STRINGS, fill } from '../../modules/rpg/strings.js';
import { blockNames, extraName, pointsLeft, problemsOf, readDraft, statsLine } from '../../modules/rpg/view/wizard-data.js';
import { runCreate, whyNot } from '../../modules/rpg/view/wizard-data-parts/create-run.js';
import { currencyOf, thingsPhrase } from './who.js';

const W = RPG_STRINGS.wizard;
const RANK_WORDS = RANKS.map(rank => rank.name);
const rankWord = skill => (Number.isSafeInteger(skill?.rank) ? RANK_WORDS[skill.rank] : RANK_NAMES[skill?.start ?? 0]);
const kindWord = kind => (kind === 'you' ? W.you : W.companion);
const note = (text, review = null) => h('p', { class: 'ps-p', dataset: { review } }, text);

// The lines under the list: the start, unspent points, the two blocks, the fight blocks also added or not, and an import's things and money.
function notes(run, now, where, world) {
  const out = [note(run.imported ? fill(W.reviewStartImported, { level: now.level ?? 1 }) : fill(now.level > 1 ? W.reviewStartSoul : W.reviewStart, { level: now.level ?? 1 }))];
  const left = Math.max(0, pointsLeft(now));
  if (left > 0) out.push(note(fill(left === 1 ? W.reviewLeftOne : W.reviewLeft, { n: left })));
  const names = blockNames(now.name || '…');
  out.push(note(fill(W.reviewBlocks, { character: names.character, skills: names.skills })));
  const { add, skipped } = where.extras;
  if (add.length) out.push(note(fill(W.reviewAlso, { list: add.map(extraName).join(', ') }), 'also'));
  const file = run.imported?.file;
  const things = file?.items?.length ?? 0, money = file?.money > 0 ? file.money : 0;
  if (things || money) {
    const parts = [things ? thingsPhrase(things, now, world) : '', money ? fill(W.reviewMoney, { amount: moneyText(money, currencyOf(world)) }) : ''];
    out.push(note(fill(W.reviewAlsoImport, { list: parts.filter(Boolean).join(' · ') }), 'import-also'));
  }
  if (skipped.length && where.room) out.push(note(fill(W.reviewNotAdded, { list: skipped.map(item => extraName(item.role)).join(', '), why: whyNot(skipped) }), 'not-added'));
  return out;
}

async function create(ctx, make, status) {
  const { run, world } = ctx;
  if (run.busy || !run.alive) return;
  run.busy = true;
  run.message = '';
  make.disabled = true;
  make.textContent = W.creating;
  status.textContent = '';
  const chat = run.chat;
  // (the chat changed under the sheet: nothing more is sent, into either chat)
  const command = (type, payload) => (run.alive && world.chatId() === chat ? ctx.command(type, payload) : { ok: false, message: W.generic });
  const result = await runCreate({ draft: readDraft(run.draft), world: world.world(), imported: run.imported, command, query: world.query, headState: world.headState, levelCap: world.levelCap });
  run.busy = false;
  if (result.ok) {
    run.created = true;
    if (!result.finished) { ctx.close(); return; }
    run.finished = result.finished;
    if (run.alive) ctx.redraw();
    return;
  }
  run.message = result.failure;
  if (run.alive) { make.disabled = false; make.textContent = W.create; status.textContent = result.failure; }
}

/** Draws the Review step (or, after a Create that left something out, what was left out and Done) for the wizard session `ctx`. */
export function drawReview(ctx) {
  const { run, world } = ctx;
  if (run.finished) {
    return h('div', { class: 'wz-review' },
      h('p', { class: 'ps-p wz-status', role: 'status' }, run.finished),
      h('div', { class: 'ps-row' }, button({ label: W.finish, tone: 'primary', dataset: { wiz: 'done' }, onClick: () => ctx.close() })));
  }
  const now = readDraft(run.draft), where = world.world();
  const problems = problemsOf(now, where);
  const skills = now.skills.length ? now.skills.map(skill => h('li', null, `${skill.name || '—'} · ${skill.stat ? skill.stat.toUpperCase() : '—'} · ${W[skill.uses]} · ${W.startsAt} ${rankWord(skill)}`)) : [h('li', null, W.noSkills)];
  const status = h('p', { class: 'ps-p wz-status', role: 'status' }, run.message);
  const make = button({ label: run.busy ? W.creating : W.create, tone: 'primary', disabled: problems.length > 0 || run.busy, dataset: { wiz: 'create' }, onClick: () => create(ctx, make, status) });
  return h('div', { class: 'wz-review' },
    h('div', { class: 'ps-sec' }, W.reviewHead),
    h('dl', { class: 'ps-kv' },
      h('dt', null, W.name), h('dd', { dataset: { review: 'who' } }, fill(W.reviewWho, { name: now.name || '—', kind: kindWord(now.kind) })),
      h('dt', null, W.statsHead), h('dd', null, statsLine(now)),
      h('dt', null, W.skillsHead), h('dd', null, h('ul', { class: 'wz-list' }, skills))),
    notes(run, now, where, world),
    h('ul', { class: 'wz-problems', role: 'alert', hidden: problems.length === 0 },
      problems.length ? h('li', { class: 'wz-problems-head' }, W.problems) : null,
      problems.map(problem => h('li', null, problem))),
    h('div', { class: 'ps-row' }, make),
    status);
}
