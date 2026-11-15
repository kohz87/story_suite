// stepper: a number input with − / + buttons, kept inside [min, max] on a step grid and under a points
// budget (a wizard's stat points). It fills a draft, never the state (SPEC §13.6): every change goes to
// `api.onDraft(name, value)`; the dialog's submit command enforces the rules again in code.
//
// `budget` is the points left *now*, with the stepper at `value`. Each step up costs `cost` points and
// each step down refunds them, so + is disabled when the budget is spent. When the dialog passes new
// props (a recomputed budget after any stepper changed), the stepper starts counting from them.
// Instead of `budget`, a shared pool: `pool` is every point the steppers may spend together and
// `spent` what they spend now, this one included (`"spent": {{ sum(draft.points) }}`), so the budget is
// `pool − spent` without a query to work it out.
//
// Public face: re-exports its parts.

export { stepperBudget, stepperClamp, stepperLimits, stepperRemaining } from './stepper-parts/math.js';
export { stepper } from './stepper-parts/widget.js';
