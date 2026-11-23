// Adapted from ui/wizard/wizard.js (keep in step when that file changes). Text RPG's New character wizard, drawn into the plug-in screen's sheet (the widget gets its body): the same four
// steps, Who · Stats · Skills · Review, the summary of the character so far on top and Back / Next under each step. `mountWizard(el, api)`: `api.command` sends, `api.close` closes the sheet.
import { h } from '../kit/dom.js';
import { button, segmented } from '../kit/controls.js';
import { newDraft } from './draft.js';
import { markFocus, restoreFocus } from './focus.js';
import { drawReview } from './review.js';
import { drawSkills } from './skills.js';
import { drawStats } from './stats.js';
import { fillSummary } from './summary.js';
import { W } from './words.js';
import { drawWho } from './who.js';

const STEPS = ['who', 'stats', 'skills', 'review'];
const DRAW = { who: drawWho, stats: drawStats, skills: drawSkills, review: drawReview };

/** Draws the wizard into `el`; → a cleanup function (the session ends when the sheet closes). */
export function mountWizard(el, api = {}) {
  const own = { draft: newDraft(), step: STEPS[0], busy: false, message: '', created: false, alive: true };
  // (the sheet's overlay wears the wizard's classes, so the suite's wizard styles apply to it as to the RPG's own)
  const sheet = el.closest?.('.sh-ov') ?? null;
  sheet?.classList?.add('wz');
  if (sheet?.dataset) sheet.dataset.sheet = 'new-character';

  function draw() {
    if (!own.alive) return;
    const at = STEPS.indexOf(own.step);
    const summary = fillSummary(h('section', { class: 'wz-sum', 'aria-label': W.summaryLabel }), own);
    const ctx = {
      run: own,
      command: (type, payload) => (api.command ? api.command(type, payload) : { ok: false, message: W.generic }),
      put: next => { own.draft = next; },
      summary: () => { if (own.alive) fillSummary(summary, own); },
      redraw: draw,
      close: () => api.close?.(),
    };
    const steps = segmented({ items: STEPS.map(id => ({ value: id, label: W.steps[id] })), value: own.step, role: 'tablist', label: W.title, className: 'wz-steps', onChange: id => go(id) });
    steps.querySelectorAll('button').forEach((tab, index) => { if (index < at) tab.classList.add('done'); });
    const foot = h('div', { class: 'ps-row wz-foot' },
      at > 0 ? button({ label: W.back, dataset: { wiz: 'back' }, onClick: () => go(STEPS[at - 1]) }) : null,
      at < STEPS.length - 1 ? button({ label: W.next, tone: 'primary', dataset: { wiz: 'next' }, onClick: () => go(STEPS[at + 1]) }) : null);
    const body = h('div', { class: `wz-body wz-${own.step}`, dataset: { step: own.step } }, DRAW[own.step](ctx));
    // (on Review, Create takes Next's place in the sticky footer)
    const create = body.querySelector('[data-wiz="create"]');
    if (create) {
      const row = create.parentElement;
      if (body.querySelector('.wz-problems:not([hidden])')) foot.append(h('span', { class: 'wz-hint' }, W.fixFirst));
      foot.append(create);
      if (row && !row.children.length) row.remove();
    }
    const marks = markFocus(el, el.ownerDocument?.activeElement ?? null);
    const was = el.querySelector?.('.wz-body');
    const scrolled = was?.dataset?.step === own.step ? was.scrollTop ?? 0 : 0;
    el.replaceChildren(steps, summary, body, foot);
    if (scrolled) body.scrollTop = scrolled;
    restoreFocus(el, marks);
    if (sheet?.dataset) sheet.dataset.step = own.step;
  }

  function go(step) {
    if (!own.alive || own.busy || !STEPS.includes(step) || step === own.step) return;
    own.step = step;
    draw();
  }

  draw();
  return () => { own.alive = false; };
}
