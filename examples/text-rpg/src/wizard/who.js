// Adapted from ui/wizard/who.js (keep in step when that file changes). The wizard's Who step for Text RPG, the RPG's: "Start from a saved character" (a file picker, what the file holds, Undo), the name (it starts as the reader's
// persona name), the starting level (1 to the level cap, with the story pack's rank when the RPG's `rpg.rank` query names one) and the note under them.
import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { FILE_LIMITS, parseCharacterFile } from './charfile.js';
import { withImport, withoutImport } from './import.js';
import { levelOf } from './limits.js';
import { RULES } from './rules.js';
import { W, fill } from './words.js';

const plural = (n, one, many) => fill(n === 1 ? one : many, { n });
const capOf = ctx => { const cap = ctx.query?.('textRpg.rules')?.cap; return Number.isInteger(cap) && cap >= 1 && cap <= 99 ? cap : 99; };

async function importFile(ctx, file) {
  const { run } = ctx;
  if (!file) return;
  let read;
  if (file.size > FILE_LIMITS.bytes) read = { ok: false, message: W.file.tooBig };
  else {
    let text = null;
    try { text = await file.text(); } catch { text = null; }
    read = text === null ? { ok: false, message: fill(W.file.unreadable, { name: String(file.name ?? '') }) } : parseCharacterFile(text);
  }
  if (!run.alive) return;
  if (!read.ok) { run.importError = read.message; ctx.redraw(); return; }
  const made = withImport(run.draft, read.file, capOf(ctx));
  run.draft = made.draft;
  run.imported = { file: read.file, fileName: String(file.name ?? ''), before: made.before };
  run.importError = '';
  ctx.redraw();
}

function importRow(ctx) {
  const { run } = ctx;
  if (run.imported) {
    const { file, fileName } = run.imported;
    const points = file.points === 0 ? W.importNoPoints : plural(file.points, W.importPointsOne, W.importPoints);
    const skills = file.skills.length === 0 ? W.importNoSkills : plural(file.skills.length, W.importSkillsOne, W.importSkills);
    const things = file.items?.length ?? 0, money = file.money > 0 ? file.money : 0;
    const list = [things ? plural(things, W.importThing, W.importThings) : '', money ? fill(W.importMoney, { amount: money.toLocaleString('en-US') }) : ''].filter(Boolean).join(' and ');
    const undo = () => { run.draft = withoutImport(run.draft, run.imported.before); run.imported = null; run.importError = ''; ctx.redraw(); };
    const said = [fill(W.importDone, { file: fileName, points, level: levelOf(run.draft), skills }), file.held.length ? fill(W.importHeld, { min: RULES.min, max: RULES.importMax }) : '',
      list ? fill(W.importAdds, { list }) : '', file.extras ? W.importLeft : '', W.importName];
    return h('div', { class: 'wz-import', role: 'status', dataset: { wiz: 'import-done' } },
      h('p', { class: 'ps-p' }, said.filter(Boolean).join(' ')),
      button({ label: W.importUndo, dataset: { wiz: 'import-undo' }, onClick: undo }));
  }
  const input = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': W.importLabel, hidden: true, onChange: () => importFile(ctx, input.files?.[0]) });
  return h('div', { class: 'wz-import', dataset: { wiz: 'import' } },
    h('p', { class: 'ps-p' }, W.importText),
    button({ label: W.importButton, dataset: { wiz: 'import-pick' }, onClick: () => input.click() }),
    input,
    run.importError ? h('p', { class: 'wz-err', role: 'alert' }, run.importError) : null);
}

/** Draws the Who step for the wizard session `ctx` ({ run, put, summary, redraw, query }). */
export function drawWho(ctx) {
  const { run } = ctx;
  const draft = () => run.draft;
  const cap = capOf(ctx);
  const name = h('input', { type: 'text', maxlength: String(RULES.nameMax), value: draft().name ?? '', dataset: { wiz: 'name' },
    onInput: () => { ctx.put({ ...draft(), name: name.value }); ctx.summary(); } });
  const level = h('input', { type: 'number', min: '1', max: String(cap), step: '1', inputmode: 'numeric', value: String(levelOf(draft())), disabled: Boolean(run.imported), dataset: { wiz: 'level' } });
  const levelHelp = h('p', { class: 'ps-p wz-help' });
  const startText = () => fill(run.imported ? W.whoNoteImported : W.whoNote, { level: levelOf(draft()) });
  const startNote = h('p', { class: 'ps-p', dataset: { wiz: 'start-note' } }, startText());
  // The rank the story's pack gives this level: the RPG's `rpg.rank` query (null when the RPG is off, as it is while Text RPG plays, or the pack has none: then the level shows without a rank).
  const levelNote = n => { let rank = null; try { rank = ctx.query?.('rpg.rank', { level: n }) ?? null; } catch { rank = null; } levelHelp.textContent = fill(W.startingLevelHelp, { cap, rank: rank?.name ? fill(W.startingLevelRank, { name: rank.name }) : '' }); };
  levelNote(levelOf(draft()));
  // 1 to the level cap; 1 is the default and is not stored.
  const setLevel = (typed, settle) => {
    if (run.imported) return; // (a saved character keeps the file's level)
    const n = Number(String(typed).trim());
    const next = Number.isFinite(n) && String(typed).trim() !== '' ? Math.min(cap, Math.max(1, Math.round(n))) : null;
    if (next === null) { if (settle) level.value = String(levelOf(draft())); return; }
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
    h('p', { class: 'ps-p wz-help' }, W.nameHint),
    h('label', { class: 'ef' }, W.startingLevel, level),
    levelHelp,
    startNote);
}
