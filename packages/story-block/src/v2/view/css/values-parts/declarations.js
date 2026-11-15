// Declaration values: filtering declaration lists, theme custom properties and data-bound custom property values.

import { decodeEscapes, splitTop, stripComments } from '../parse-parts/text.js';
import { valueProblem } from './url-check.js';

/**
 * Filter a declaration list (a rule's body or a `style` attribute). Returns `{ text, warnings }` with
 * the declarations kept, `prop: value` joined by `; `. `keyframes` maps names to their prefixed form.
 */
export function filterDeclarations(body, { keyframes = null, where = 'style' } = {}) {
    const kept = [];
    const warnings = [];
    for (const raw of splitTop(stripComments(String(body ?? '')), ';')) {
        const text = raw.trim();
        if (!text) continue;
        const colon = text.indexOf(':');
        if (colon <= 0) {
            warnings.push(`Dropped "${text.slice(0, 60)}" in ${where}: not a declaration.`);
            continue;
        }
        const prop = text.slice(0, colon).trim();
        let value = text.slice(colon + 1).trim();
        if (!value) continue;
        const name = decodeEscapes(prop).toLowerCase();
        if (!/^-{0,2}[a-z][a-z0-9-]*$/i.test(prop) || /[{}]/.test(value.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ''))) {
            warnings.push(`Dropped "${text.slice(0, 60)}" in ${where}: not a declaration.`);
            continue;
        }
        if (name === 'behavior' || name === '-moz-binding') {
            warnings.push(`Dropped ${prop} in ${where}: it can run code.`);
            continue;
        }
        if (name === 'position' && /^fixed\b/i.test(decodeEscapes(value).trim())) {
            warnings.push(`Dropped position: fixed in ${where}: screens stay inside their place.`);
            continue;
        }
        const problem = valueProblem(value);
        if (problem) {
            warnings.push(`Dropped ${prop} in ${where}: ${problem} is not allowed (only data: and https: URLs).`);
            continue;
        }
        if (keyframes?.size && (name === 'animation' || name === 'animation-name')) {
            value = value.replace(/-?[A-Za-z_][\w-]*/g, word => keyframes.get(word) ?? word);
        }
        kept.push(`${prop}: ${value}`);
    }
    return { text: kept.join('; '), warnings };
}

/**
 * A screen's `theme` as custom properties to set on its root: `[[name, value]]`, names `--x` only,
 * values passing the same checks as declarations. Returns `{ vars, warnings }`.
 */
export function themeVars(theme) {
    const vars = [];
    const warnings = [];
    for (const [name, raw] of Object.entries(theme && typeof theme === 'object' ? theme : {})) {
        const value = typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : typeof raw === 'string' ? raw.trim() : null;
        if (!/^--[A-Za-z0-9_-]+$/.test(name)) warnings.push(`Theme key "${name}" is not a custom property (--name).`);
        else if (value === null || /[;{}]/.test(value)) warnings.push(`Theme value for ${name} is not a single CSS value.`);
        else {
            const problem = valueProblem(value);
            if (problem) warnings.push(`Theme value for ${name}: ${problem} is not allowed.`);
            else vars.push([name, value]);
        }
    }
    return { vars, warnings };
}

/** A value for a CSS custom property from data (data-bind-var): numbers as written, safe strings, else ''. */
export function cssVarValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value !== 'string') return '';
    const text = value.trim();
    if (text.length > 2000 || /[;{}<>\\]/.test(text) || valueProblem(text)) return '';
    return text;
}
