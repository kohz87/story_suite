// Renders the RPG and fights section: its module switches, then rules, progression and fights; the Difficulty row says what each choice changes, a change to
// Difficulty or a Custom number redraws the page from the host's fresh rows, and a Custom difficulty adds what its editors leave out.
import { h } from '../../kit/dom.js';
import { renderGroups } from '../fields.js';
import { difficultyLines } from '../../select/rpg-difficulty.js';
import { DIFFICULTY_WORDS } from '../../select/rpg-rows.js';
import { sectionFrame } from './start.js';

const CUSTOM_NOTE = 'Custom keeps the earlier roll formula’s other numbers (the foe’s base, the margins, exchanges per reply) as they are: the fight board does not use them, so they are not shown here. Characters already made keep their stats.';
// The last refusal of a Custom number, per open overlay (its ctx), shown once on the next draw.
const refused = new WeakMap();
const redraws = key => key === 'rpg.difficulty' || String(key).startsWith('rpg.custom.');

// Under the Difficulty row's hint (the chosen one's details): one line per choice, the chosen one marked, then what is the same at every difficulty.
function explainDifficulty(nodes, chosen) {
  const label = nodes.flatMap(n => [...(n.querySelectorAll?.('.srow[data-key="rpg.difficulty"] .lb') ?? [])])[0];
  if (!label) return;
  const { lines, same } = difficultyLines();
  for (const { word, text } of lines) {
    const name = DIFFICULTY_WORDS[word];
    label.appendChild(h('small', { class: ['diff-line', name === chosen && 'on'], dataset: { diff: word } }, h('span', { class: 'dn' }, name), `: ${text}`));
  }
  label.appendChild(h('small', { class: 'diff-line diff-same' }, same));
}

// The rows' changes go to the host as before; a Difficulty or Custom change then draws the page again (its rows read fresh), keeping a refusal to show.
function changesThatRedraw(section, ctx) {
  const settle = (answer) => {
    if (answer?.ok === false && answer.message) refused.set(ctx, String(answer.message));
    // (the field or button the reader is on when the page draws again, e.g. after Tab, keeps the focus: found again by its row key and value)
    const doc = ctx.doc ?? globalThis.document, on = doc?.activeElement, key = on?.closest?.('.srow')?.dataset?.key, value = on?.dataset?.value;
    ctx.go?.(section.id);
    if (!key) return;
    const row = [...(doc.querySelectorAll?.('.srow') ?? [])].find(r => r.dataset?.key === key);
    const target = [...(row?.querySelectorAll?.('input, select, button') ?? [])].find(el => value === undefined || el.dataset?.value === value);
    target?.focus?.();
  };
  return {
    ...ctx,
    onChange: (key, value, row) => {
      const answer = ctx.onChange?.(key, value, row);
      if (!redraws(key)) return answer;
      // (on the next task: a number's change fires as its field loses focus, before the focus reaches the next field, which the redraw must find)
      const later = done => setTimeout(() => settle(done), 0);
      if (typeof answer?.then === 'function') answer.then(later, error => later({ ok: false, message: String(error?.message ?? error) }));
      else later(answer);
      return answer;
    },
  };
}

/** Returns the RPG page nodes for `section` (its rows read fresh from the host when it answers `ctx.view('settings')`): the Difficulty row explained; Custom adds a note. */
export function renderRpgSection(section, ctx) {
  const live = ctx.view?.('settings')?.sections?.find?.(s => s.id === section.id) ?? section;
  const chosen = (live.rows ?? []).find(r => r.key === 'rpg.difficulty')?.value;
  const message = refused.get(ctx);
  refused.delete(ctx);
  const notes = [
    message ? h('p', { class: 'fine custom-refused', role: 'alert' }, message) : null,
    chosen === 'Custom' ? h('p', { class: 'fine custom-note' }, CUSTOM_NOTE) : null,
  ].filter(Boolean);
  const before = ctx.body?.({ ...live, rows: [] }) ?? [];
  const nodes = sectionFrame(live, { ...ctx, body: () => [...before, ...renderGroups(live.rows ?? [], changesThatRedraw(section, ctx))] });
  explainDifficulty(nodes, chosen);
  // The notes sit under the Custom editors, in their card (else after the page's cards).
  const editors = nodes.flatMap(n => [...(n.querySelectorAll?.('.srow') ?? [])]).filter(r => String(r.dataset?.key ?? '').startsWith('rpg.custom.'));
  const last = editors.at(-1);
  if (last && notes.length) last.parentNode.insertBefore(h('div', { class: 'rpg-notes' }, notes), last.nextSibling);
  else nodes.push(...notes);
  return nodes;
}
