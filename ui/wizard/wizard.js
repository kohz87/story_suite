// The new view's New character wizard: one bottom sheet (kit/sheet.js) with the old wizard's four steps, Who · Stats · Skills · Review, the
// summary row of the character so far on top and Back / Next under each step. The rules, the draft and Create are modules/rpg's own
// (wizard-data.js, join.js, wizard-data-parts/create-run.js); only the drawing is this view's. `open(prefill, { onEnd })` opens it on a fresh
// You, or filled in from a join payload ({ name, soul, best, skills }: People › Add to party › Edit first); `onEnd(created)` is told once when it closes.

import { h } from '../kit/dom.js';
import { button, segmented } from '../kit/controls.js';
import { openSheet } from '../kit/sheet.js';
import { joinDraft } from '../../modules/rpg/join.js';
import { RPG_STRINGS } from '../../modules/rpg/strings.js';
import { WIZARD_STEPS, newDraft } from '../../modules/rpg/view/wizard-data.js';
import { drawWho } from './who.js';
import { drawStats } from './stats.js';
import { drawSkills } from './skills.js';
import { drawReview } from './review.js';
import { markFocus, restoreFocus } from './focus.js';
import { fillSummary } from './summary.js';

const W = RPG_STRINGS.wizard;
const NEXT = 'Next';
// (from 1100 px, beside a Create that a problem holds back; wizard.css shows it there only)
const FIX_FIRST = 'Fix the problem above, then Create.';
/** The screen id `port.open` names for this window (the old wizard's). */
export const WIZARD_ID = 'story-block/new-character';

const safe = (fn, fallback) => { try { return fn() ?? fallback; } catch { return fallback; } };
const DRAW = { who: drawWho, stats: drawStats, skills: drawSkills, review: drawReview };

/**
 * `createNewWizard({ world, command, sheetCtx })`: `world` is ui/wizard/world.js's; `command(type, payload)` the engine's (sent as the old wizard
 * sends it); `sheetCtx()` → { doc, backStack, sheetHost } for the sheet. → { open(prefill?, { onEnd }?) → true when it opened, isOpen(), close(), session() }.
 */
export function createNewWizard({ world, command, sheetCtx = () => ({}) }) {
  let run = null;

  function draw(own) {
    if (!own.alive) return;
    const sheet = own.sheet;
    const at = WIZARD_STEPS.indexOf(own.step);
    const summary = fillSummary(h('section', { class: 'wz-sum', 'aria-label': W.summaryLabel }), own, world);
    const ctx = {
      run: own, world, command,
      put: next => { own.draft = next; },
      summary: () => { if (own.alive) fillSummary(summary, own, world); },
      redraw: () => draw(own),
      close: () => sheet.close(),
    };
    const steps = segmented({ items: WIZARD_STEPS.map(id => ({ value: id, label: W.steps[id] })), value: own.step, role: 'tablist', label: W.title, className: 'wz-steps', onChange: id => go(own, id) });
    // (the steps before this one are done: from 1100 px their number turns to a ✓, wizard.css)
    steps.querySelectorAll('button').forEach((tab, index) => { if (index < at) tab.classList.add('done'); });
    // (after a Create that left something out only Done stays: the steps are not walked again)
    const foot = own.finished ? null : h('div', { class: 'ps-row wz-foot' },
      at > 0 ? button({ label: W.back, dataset: { wiz: 'back' }, onClick: () => go(own, WIZARD_STEPS[at - 1]) }) : null,
      at < WIZARD_STEPS.length - 1 ? button({ label: NEXT, tone: 'primary', dataset: { wiz: 'next' }, onClick: () => go(own, WIZARD_STEPS[at + 1]) }) : null);
    const body = h('div', { class: `wz-body wz-${own.step}`, dataset: { step: own.step } }, DRAW[own.step](ctx));
    // (on Review, Create takes Next's place in the sticky footer: left at the end of a long review, the footer covered half of it, SOAK2UI 10)
    const create = foot ? body.querySelector('[data-wiz="create"]') : null;
    if (create) {
      const row = create.parentElement;
      if (body.querySelector('.wz-problems:not([hidden])')) foot.append(h('span', { class: 'wz-hint' }, FIX_FIRST));
      foot.append(create);
      if (row && !row.children.length) row.remove();
    }
    // (the keyboard stays on the equivalent control: the tab or the Next / Back button used, or the field, stepper or skill row being worked)
    const marks = markFocus(sheet.body, sheet.el.ownerDocument?.activeElement ?? null);
    // (from 1100 px the step scrolls on its own, and a new one is drawn each time: a redraw on the same step keeps where it was)
    const was = sheet.body.querySelector?.('.wz-body');
    const scrolled = was?.dataset?.step === own.step ? was.scrollTop ?? 0 : 0;
    // (no footer once Create has finished: a null here would be drawn as the text "null")
    sheet.body.replaceChildren(...[steps, summary, body, foot].filter(Boolean));
    if (scrolled) body.scrollTop = scrolled;
    restoreFocus(sheet.body, marks);
    sheet.el.dataset.step = own.step;
  }

  function go(own, step) {
    if (!own.alive || own.busy || own.finished || !WIZARD_STEPS.includes(step) || step === own.step) return;
    own.step = step;
    draw(own);
  }

  function open(prefill = null, { onEnd = null } = {}) {
    if (run?.alive) return false;
    const numbers = safe(world.rules, null);
    const draft = prefill && typeof prefill === 'object' ? joinDraft(prefill, numbers) : { ...newDraft({ persona: safe(world.readerName, ''), rules: numbers }) };
    const own = { draft, step: WIZARD_STEPS[0], busy: false, message: '', created: false, finished: '', imported: null, importError: '', pendingSet: null, alive: true, sheet: null,
      onEnd: typeof onEnd === 'function' ? onEnd : null, chat: safe(world.chatId, '') };
    run = own;
    own.sheet = openSheet(sheetCtx() ?? {}, { title: W.title, id: 'new-character', onClose: () => {
      own.alive = false;
      if (run === own) run = null;
      const end = own.onEnd;
      own.onEnd = null;
      try { end?.(own.created); } catch { /* the caller's follow-up never breaks closing */ }
    } });
    own.sheet.el.classList.add('wz');
    draw(own);
    return true;
  }

  return { open, isOpen: () => Boolean(run?.alive), close: () => { run?.sheet?.close(); }, session: () => run };
}
