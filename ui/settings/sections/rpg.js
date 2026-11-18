// Renders the RPG and fights section: its module switches, then rules, progression and fights; the Difficulty row says what each choice changes, a Difficulty
// change draws the page again from the host's fresh rows, a Custom number updates its own row and the hint in place, and Custom adds what its editors leave out.
import { h } from '../../kit/dom.js';
import { renderGroups } from '../fields.js';
import { difficultyLines } from '../../select/rpg-difficulty.js';
import { DIFFICULTY_WORDS } from '../../select/rpg-rows.js';
import { sectionFrame } from './start.js';

const CUSTOM_NOTE = 'Custom keeps the earlier roll formula’s other numbers (the foe’s base, the margins, exchanges per reply) as they are: the fight board does not use them, so they are not shown here. Characters already made keep their stats.';
const rowsIn = nodes => nodes.flatMap(n => [...(n.querySelectorAll?.('.srow') ?? [])]);
const rowOf = (nodes, key) => rowsIn(nodes).find(r => r.dataset?.key === key);

// Under the Difficulty row's hint (the chosen one's details): one line per choice, the chosen one marked, then what is the same at every difficulty.
function explainDifficulty(nodes, chosen) {
  const label = rowOf(nodes, 'rpg.difficulty')?.querySelector('.lb');
  if (!label) return;
  const { lines, same } = difficultyLines();
  for (const { word, text } of lines) {
    const name = DIFFICULTY_WORDS[word];
    label.appendChild(h('small', { class: ['diff-line', name === chosen && 'on'], dataset: { diff: word } }, h('span', { class: 'dn' }, name), `: ${text}`));
  }
  label.appendChild(h('small', { class: 'diff-line diff-same' }, same));
}

// A Custom number, once the host answered: its field shows the stored number (held to its range, or put back when refused), the Difficulty hint the new
// numbers, and the notes the refusal's reason. Nothing is redrawn, so a click that follows the typing (its change fires on the press) still lands.
function settleCustom(page, ctx, sectionId, key, answer) {
  const fresh = ctx.view?.('settings')?.sections?.find?.(s => s.id === sectionId)?.rows ?? [];
  const now = k => fresh.find(r => r.key === k);
  const hint = rowOf(page.nodes, 'rpg.difficulty')?.querySelector('.lb small');
  if (hint && now('rpg.difficulty')?.hint) hint.textContent = now('rpg.difficulty').hint;
  const input = rowOf(page.nodes, key)?.querySelector('input');
  if (input && now(key)) input.value = String(now(key).value);
  const notes = page.nodes.flatMap(n => [...(n.querySelectorAll?.('.rpg-notes') ?? [])])[0];
  notes?.querySelector('.custom-refused')?.remove();
  if (notes && answer?.ok === false && answer.message) notes.insertBefore(h('p', { class: 'fine custom-refused', role: 'alert' }, String(answer.message)), notes.firstChild);
}

// A Difficulty change draws the page again (its rows read fresh), on the next task, and the button the reader is on keeps the focus.
function redrawAfterDifficulty(ctx, sectionId) {
  const doc = ctx.doc ?? globalThis.document, on = doc?.activeElement, key = on?.closest?.('.srow')?.dataset?.key, value = on?.dataset?.value;
  ctx.go?.(sectionId);
  if (!key) return;
  const row = [...(doc.querySelectorAll?.('.srow') ?? [])].find(r => r.dataset?.key === key);
  [...(row?.querySelectorAll?.('input, select, button') ?? [])].find(el => value === undefined || el.dataset?.value === value)?.focus?.();
}

function changes(page, ctx, sectionId) {
  return {
    ...ctx,
    onChange: (key, value, row) => {
      const answer = ctx.onChange?.(key, value, row);
      const custom = String(key).startsWith('rpg.custom.');
      if (!custom && key !== 'rpg.difficulty') return answer;
      const settle = done => setTimeout(() => (custom ? settleCustom(page, ctx, sectionId, key, done) : redrawAfterDifficulty(ctx, sectionId)), 0);
      if (typeof answer?.then === 'function') answer.then(settle, error => settle({ ok: false, message: String(error?.message ?? error) }));
      else settle(answer);
      return answer;
    },
  };
}

/** Returns the RPG page nodes for `section` (its rows read fresh from the host when it answers `ctx.view('settings')`): the Difficulty row explained; Custom adds a note. */
export function renderRpgSection(section, ctx) {
  const live = ctx.view?.('settings')?.sections?.find?.(s => s.id === section.id) ?? section;
  const chosen = (live.rows ?? []).find(r => r.key === 'rpg.difficulty')?.value;
  const page = { nodes: [] };
  const before = ctx.body?.({ ...live, rows: [] }) ?? [];
  page.nodes = sectionFrame(live, { ...ctx, body: () => [...before, ...renderGroups(live.rows ?? [], changes(page, ctx, section.id))] });
  explainDifficulty(page.nodes, chosen);
  // The notes sit under the Custom editors, in their card.
  const editors = rowsIn(page.nodes).filter(r => String(r.dataset?.key ?? '').startsWith('rpg.custom.'));
  if (chosen === 'Custom' && editors.length) editors.at(-1).parentNode.insertBefore(h('div', { class: 'rpg-notes' }, h('p', { class: 'fine custom-note' }, CUSTOM_NOTE)), editors.at(-1).nextSibling);
  else if (chosen === 'Custom') page.nodes.push(h('p', { class: 'fine custom-note' }, CUSTOM_NOTE));
  return page.nodes;
}
