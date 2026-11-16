// The chip-style choice fields: one-of or several-of chips, the joined segmented row, and chips that fill a comma-separated text.

import { optionsOf } from '../../schema.js';
import { button, h, named, setDisabled } from '../shared.js';

// ---- chips -----------------------------------------------------------------------------------------

/**
 * The chip picker. One of the options (a radio group: the arrow keys move and choose, one Tab stop) or, with
 * `field.multiple`, several (toggle buttons with aria-pressed; the value is a list of option values in the
 * options' order).
 */
export function chipsField(ctx) {
    const { doc, field } = ctx;
    const many = field.multiple === true;
    const options = optionsOf(field);
    const root = h(doc, 'div', 'ss-chips');
    root.setAttribute('role', many ? 'group' : 'radiogroup');
    named(root, ctx);
    let value = many ? (Array.isArray(ctx.value) ? ctx.value.map(String) : []) : String(ctx.value ?? options[0]?.value ?? '');
    let locked = false;
    let off = false;
    const chips = options.map(option => {
        const chip = button(doc, 'ss-chip ss-tap-pill');
        chip.setAttribute('data-value', option.value);
        chip.textContent = option.label;
        if (!many) chip.setAttribute('role', 'radio');
        root.appendChild(chip);
        return chip;
    });
    const selectedAt = () => (many ? -1 : Math.max(0, options.findIndex(option => option.value === value)));
    function paint() {
        chips.forEach((chip, at) => {
            const on = many ? value.includes(options[at].value) : options[at].value === value;
            chip.classList.toggle('ss-chip-on', on);
            if (many) chip.setAttribute('aria-pressed', String(on));
            else {
                chip.setAttribute('aria-checked', String(on));
                chip.setAttribute('tabindex', at === selectedAt() ? '0' : '-1');
            }
        });
    }
    paint();
    function choose(at, { fromKey = false } = {}) {
        if (locked || chips[at].disabled) return;
        const option = options[at];
        if (many) value = options.map(o => o.value).filter(v => (v === option.value ? !value.includes(v) : value.includes(v)));
        else if (option.value === value) {
            if (fromKey) chips[at].focus?.({ preventScroll: true });
            return;
        } else value = option.value;
        paint();
        if (fromKey) chips[at].focus?.({ preventScroll: true });
        ctx.onChange(many ? [...value] : value, { typed: many ? [...value] : value });
    }
    chips.forEach((chip, at) => chip.addEventListener('click', () => choose(at)));
    if (!many) {
        // A radio group: the arrow keys move the choice (wrapping); Home and End go to the ends.
        root.addEventListener('keydown', event => {
            const at = chips.findIndex(chip => chip === event.target || chip.contains?.(event.target));
            let next = null;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % chips.length;
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + chips.length) % chips.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = chips.length - 1;
            if (next === null || at < 0) return;
            event.preventDefault?.();
            choose(next, { fromKey: true });
        });
    }
    const handle = {
        el: root, input: root,
        get: () => (many ? [...value] : value),
        set(next) {
            value = many ? (Array.isArray(next) ? next.map(String) : []) : String(next ?? '');
            paint();
        },
        setDisabled(on) {
            off = Boolean(on);
            chips.forEach(chip => setDisabled(chip, off || locked));
        },
        setReadOnly(on) {
            locked = Boolean(on);
            chips.forEach(chip => setDisabled(chip, locked || off));
        },
        destroy() {},
    };
    handle.setDisabled(Boolean(ctx.disabled));
    handle.setReadOnly(Boolean(ctx.readOnly));
    return handle;
}

// ---- segmented: one choice as a joined row of buttons ----------------------------------------------

/**
 * A choice with `form: 'segmented'`: the one-of chips (a radio group with arrow keys) drawn as one joined row, for a few short
 * options (Text size: Normal, 110%, 120%). Same value, events and keys as `chipsField`; only the class differs (`ss-segmented`).
 */
export function segmentedField(ctx) {
    const handle = chipsField({ ...ctx, field: { ...ctx.field, multiple: false } });
    handle.el.classList.add('ss-segmented');
    return handle;
}

// ---- chips that fill a text -------------------------------------------------------------------------

/**
 * Several chips over a text setting: the stored text is a comma-separated list ("~ time, ~ place") and each option is one entry
 * (`options`: the entries the reader may choose). Entries the options do not list are kept as they are, never drawn and never
 * dropped by a change here. The value reported is the text, the chosen entries in the options' order, then the kept ones.
 * `field.read(text)` → the entries (default: split on commas, semicolons and newlines, each trimmed, lower-cased).
 */
export function chipsetField(ctx) {
    const { field } = ctx;
    const options = optionsOf(field);
    const read = typeof field.read === 'function' ? field.read : text => String(text ?? '').split(/[,;\n]+/).map(part => part.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
    const known = new Set(options.map(option => option.value));
    let extras = [];
    const split = text => {
        const entries = read(text);
        extras = entries.filter(entry => !known.has(entry));
        return options.map(option => option.value).filter(value => entries.includes(value));
    };
    const inner = chipsField({ ...ctx, field: { ...field, multiple: true }, value: split(ctx.value), onChange: chosen => {
        const text = [...chosen, ...extras].join(', ');
        ctx.onChange(text, { typed: text });
    } });
    return { ...inner, get: () => [...inner.get(), ...extras].join(', '), set(text) { inner.set(split(text)); } };
}
