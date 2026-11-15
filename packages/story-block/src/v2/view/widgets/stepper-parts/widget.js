// The stepper widget: the number input with − / + buttons, drawn and wired to the draft.

import { clamp, fmt, h, num, setTone, shell, str } from '../dom.js';
import { defineWidget, resolveProps } from '../props.js';
import { stepperBudget, stepperClamp, stepperLimits, stepperRemaining } from './math.js';
import { EPSILON } from './shared-epsilon.js';

const props = {
    name: { type: 'string', required: true, default: '' },     // the draft field
    value: { type: 'number', default: 0 },
    min: { type: 'number', default: 0 },
    max: { type: 'number', default: null },                     // null: no maximum
    step: { type: 'number', default: 1 },
    budget: { type: 'number', default: null },                  // null: no budget
    pool: { type: 'number', default: null },                    // shared budget, used when `budget` is null
    spent: { type: 'number', default: 0 },                      // points spent from the pool, this stepper's included
    cost: { type: 'number', default: 1 },                       // points per step up
    label: { type: 'string', default: '' },
    budgetLabel: { type: 'string', default: 'Points left' },
    showBudget: { type: 'boolean', default: true },             // false: the budget still limits the stepper, but the line under it is left out
    tone: { type: 'string', default: 'neutral' },
    disabled: { type: 'boolean', default: false },
};

function render(el, input, api) {
    return shell(el, 'div', 'stepper', ({ doc, root, listen }) => {
        root.setAttribute('role', 'group');
        const label = h(doc, 'span', 'ss-w-stepper-label');
        label.setAttribute('aria-hidden', 'true');
        const row = h(doc, 'div', 'ss-w-stepper-row');
        const dec = h(doc, 'button', 'ss-w-stepper-btn ss-w-stepper-dec', '−');
        const inc = h(doc, 'button', 'ss-w-stepper-btn ss-w-stepper-inc', '+');
        dec.setAttribute('type', 'button');
        inc.setAttribute('type', 'button');
        const field = h(doc, 'input', 'ss-w-stepper-input');
        field.setAttribute('type', 'number');
        field.setAttribute('inputmode', 'decimal');
        row.append(dec, field, inc);
        const budgetNote = h(doc, 'span', 'ss-w-stepper-budget');
        budgetNote.setAttribute('aria-live', 'polite');
        root.append(label, row, budgetNote);

        let p = resolveProps(props, input);
        let base = 0;
        let limits = stepperLimits({ value: 0, min: 0, max: null, step: 1, budget: null, cost: 1 });
        let value = 0;

        function paint() {
            field.value = fmt(value);
            field.setAttribute('aria-valuenow', fmt(value));
            const remaining = stepperRemaining(base, value, p.budget, limits);
            dec.disabled = p.disabled || value - limits.step < limits.lo - EPSILON;
            inc.disabled = p.disabled || value + limits.step > limits.hi + EPSILON;
            field.disabled = p.disabled;
            root.classList.toggle('ss-w-spent', remaining !== null && remaining < limits.cost);
            budgetNote.hidden = remaining === null || !p.showBudget;
            budgetNote.textContent = remaining === null || !p.showBudget ? '' : `${p.budgetLabel || 'Points left'}: ${fmt(remaining)}`;
        }

        function set(raw) {
            const next = stepperClamp(raw, limits);
            const changed = next !== value;
            value = next;
            paint();
            if (changed && p.name && typeof api?.onDraft === 'function') {
                try { api.onDraft(p.name, value); } catch { /* the dialog reports its own problems */ }
            }
        }

        function update(next) {
            p = resolveProps(props, next);
            p.budget = stepperBudget(p);
            const name = str(p.label) || str(p.name) || 'Value';
            setTone(root, p.tone);
            root.setAttribute('aria-label', name);
            label.textContent = p.label;
            label.hidden = !p.label;
            field.setAttribute('aria-label', name);
            dec.setAttribute('aria-label', `Decrease ${name}`);
            inc.setAttribute('aria-label', `Increase ${name}`);
            const start = num(p.value, 0);
            limits = stepperLimits({ ...p, value: start });
            base = clamp(start, limits.lo, Math.max(limits.lo, limits.hi));
            limits = stepperLimits({ ...p, value: base });
            value = base;
            field.setAttribute('min', fmt(limits.lo));
            if (Number.isFinite(limits.hi)) field.setAttribute('max', fmt(limits.hi));
            else field.removeAttribute('max');
            field.setAttribute('step', fmt(limits.step));
            paint();
        }

        listen(dec, 'click', () => { if (!p.disabled) set(value - limits.step); });
        listen(inc, 'click', () => { if (!p.disabled) set(value + limits.step); });
        listen(field, 'change', () => set(field.value));
        listen(field, 'keydown', event => {
            const big = limits.step * 10;
            const target = {
                ArrowUp: value + limits.step,
                ArrowDown: value - limits.step,
                PageUp: value + big,
                PageDown: value - big,
                Home: limits.lo,
                End: Number.isFinite(limits.hi) ? limits.hi : null,
            }[event.key];
            if (target === undefined || target === null) {
                if (event.key === 'Enter') set(field.value);
                return;
            }
            event.preventDefault?.();
            if (!p.disabled) set(target);
        });

        update(input);
        return { update };
    });
}

export const stepper = defineWidget({ props, primary: 'value', render });
