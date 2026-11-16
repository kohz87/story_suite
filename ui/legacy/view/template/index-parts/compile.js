// Compiles a template's HTML once into a frozen tree of bindings (sanitised first), and tells whether a value is one.

import { PURIFY_CONFIG, markControlTypes, sanitizeNodes } from '../sanitize.js';
import { compileChildren } from './element.js';

const COMPILED = Symbol.for('storySuite.template.compiled');

/** True for the result of compileTemplate. */
export const isCompiled = value => Boolean(value?.[COMPILED]);

/**
 * Compile a template once. `sanitize(html, config)` is DOMPurify's (optional); the strict allow-list always
 * runs after it. Returns a frozen `{ nodes, warnings }` (warnings are plain sentences).
 */
export function compileTemplate(html, { sanitize = null } = {}) {
    const warnings = [];
    let text = String(html ?? '');
    if (typeof sanitize === 'function') {
        try {
            // SillyTavern's DOMPurify drops controls' `type`: it travels as TYPE_MARK and comes back below.
            text = String(sanitize(markControlTypes(text), { ...PURIFY_CONFIG }) ?? '');
        } catch (error) {
            warnings.push(`The sanitiser failed (${error?.message ?? error}); the strict allow-list was used alone.`);
        }
    }
    const filtered = sanitizeNodes(text);
    warnings.push(...filtered.warnings);
    const nodes = compileChildren(filtered.nodes, warnings);
    return Object.freeze({ [COMPILED]: true, nodes, warnings: Object.freeze([...new Set(warnings)]) });
}
