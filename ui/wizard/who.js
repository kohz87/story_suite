// The wizard's Who step in the new view: "Start from a saved character" (import a file, or undo it), the name and the starting level, with the
// old step's words and rules (modules/rpg/view/wizard/who.js): the file is read by charfile.js, the draft changed by wizard-data's withImport.

import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { DEFAULT_CURRENCY } from '../../modules/inventory/money.js';
import { FILE_LIMITS, moneyText, parseCharacterFile, thingsWord } from '../../modules/rpg/charfile.js';
import { LEVEL, CREATION } from '../../modules/rpg/names.js';
import { rankOf as bandRank } from '../../modules/rpg/levels.js';
import { RPG_STRINGS, fill } from '../../modules/rpg/strings.js';
import { readDraft, withImport, withoutImport } from '../../modules/rpg/view/wizard-data.js';
import { ownerFor } from '../../modules/rpg/view/wizard-data-parts/create-run.js';

const W = RPG_STRINGS.wizard;
const safe = (fn, fallback) => { try { return fn() ?? fallback; } catch { return fallback; } };

/** The purse's currency, and "3 things to the party's bag" (or "carried by Ren"): the Review step says the same. */
export const currencyOf = world => safe(() => world.query('inventory.currency'), null) ?? DEFAULT_CURRENCY;
export const thingsPhrase = (n, draft, world) => (ownerFor(draft, world.query) === 'party' ? fill(W.reviewThingsBag, { things: thingsWord(n) }) : fill(W.reviewThings, { things: thingsWord(n), name: draft.name }));

async function importFile(ctx, file) {
  const { run } = ctx;
  if (!file) return;
  let read;
  if (file.size > FILE_LIMITS.bytes) read = { ok: false, message: RPG_STRINGS.file.tooBig };
  else {
    let text = null;
    try { text = await file.text(); } catch { text = null; }
    read = text === null ? { ok: false, message: fill(RPG_STRINGS.file.unreadable, { name: String(file.name ?? '') }) } : parseCharacterFile(text);
  }
  if (!run.alive) return;
  if (!read.ok) { run.importError = read.message; ctx.redraw(); return; }
  const made = withImport(run.draft, read.file);
  run.draft = made.draft;
  run.imported = { file: read.file, fileName: String(file.name ?? ''), before: made.before };
  run.importError = '';
  ctx.redraw();
}

function importRow(ctx) {
  const { run, world } = ctx;
  if (run.imported) {
    const { file, fileName } = run.imported;
    const points = file.points === 0 ? W.importNoPoints : fill(file.points === 1 ? W.importPointsOne : W.importPoints, { n: file.points });
    const skills = file.skills.length === 0 ? W.importNoSkills : fill(file.skills.length === 1 ? W.importSkillsOne : W.importSkills, { n: file.skills.length });
    const things = file.items?.length ?? 0, money = file.money > 0 ? file.money : 0;
    const list = [things ? thingsPhrase(things, readDraft(run.draft), world) : '', money ? fill(W.importMoney, { amount: moneyText(money, currencyOf(world)) }) : ''].filter(Boolean).join(' and ');
    const undo = () => { run.draft = withoutImport(run.draft, run.imported.before); run.imported = null; run.importError = ''; ctx.redraw(); };
    return h('div', { class: 'wz-import', role: 'status', dataset: { wiz: 'import-done' } },
      h('p', { class: 'ps-p' }, [fill(W.importDone, { file: fileName, points, level: file.level ?? 1, skills }), list ? fill(W.importAdds, { list }) : '', W.importName].filter(Boolean).join(' ')),
      button({ label: W.importUndo, dataset: { wiz: 'import-undo' }, onClick: undo }));
  }
  const input = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': W.importLabel, hidden: true, onChange: () => importFile(ctx, input.files?.[0]) });
  return h('div', { class: 'wz-import', dataset: { wiz: 'import' } },
    h('p', { class: 'ps-p' }, W.importText),
    button({ label: W.importButton, dataset: { wiz: 'import-pick' }, onClick: () => input.click() }),
    input,
    run.importError ? h('p', { class: 'wz-err', role: 'alert' }, run.importError) : null);
}

/** Draws the Who step for the wizard session `ctx` ({ run, world, put, summary, redraw }). */
export function drawWho(ctx) {
  const { run, world } = ctx;
  const draft = () => run.draft;
  const capNow = () => Math.max(1, Math.min(LEVEL.max, Number.isSafeInteger(safe(world.levelCap, null)) ? world.levelCap() : LEVEL.max));
  const name = h('input', { type: 'text', maxlength: String(CREATION.name), value: draft().name ?? '', dataset: { wiz: 'name' },
    onInput: () => { ctx.put({ ...draft(), name: name.value }); ctx.summary(); } });
  const level = h('input', { type: 'number', min: '1', max: String(capNow()), step: '1', inputmode: 'numeric', value: String(draft().level ?? 1), dataset: { wiz: 'level' } });
  const levelHelp = h('p', { class: 'ps-p wz-help' });
  const startText = () => (run.imported ? fill(W.whoNoteImported, { level: readDraft(draft()).level ?? 1 }) : fill(draft().level > 1 ? W.whoNoteSoul : W.whoNote, { level: readDraft(draft()).level ?? 1 }));
  const startNote = h('p', { class: 'ps-p', dataset: { wiz: 'start-note' } }, startText());
  const levelNote = n => { const rank = bandRank(n, safe(world.levels, {})?.ranks); levelHelp.textContent = fill(W.startingLevelHelp, { rank: rank ? fill(W.startingLevelRank, { name: rank.name, from: rank.from, to: rank.to }) : '' }); };
  levelNote(draft().level ?? 1);
  // 1 to the story's level cap; 1 is the default and is not stored (the old step's rule).
  const setLevel = (typed, settle) => {
    const n = Number(String(typed).trim());
    const next = Number.isFinite(n) && String(typed).trim() !== '' ? Math.min(capNow(), Math.max(1, Math.round(n))) : null;
    if (next === null) { if (settle) level.value = String(draft().level ?? 1); return; }
    if (settle) level.value = String(next);
    const { level: _was, ...rest } = draft();
    ctx.put(next > 1 ? { ...rest, level: next } : rest);
    levelNote(next);
    ctx.summary();
    startNote.textContent = startText();
  };
  level.addEventListener('input', () => setLevel(level.value, false));
  level.addEventListener('change', () => { setLevel(level.value, true); ctx.redraw(); });
  return h('div', { class: 'wz-form' },
    importRow(ctx),
    h('label', { class: 'ef' }, W.name, name),
    h('p', { class: 'ps-p wz-help' }, draft().kind === 'you' ? W.nameHint : W.nameHintOther),
    h('label', { class: 'ef' }, W.startingLevel, level),
    levelHelp,
    startNote);
}
