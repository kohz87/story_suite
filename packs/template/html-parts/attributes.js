// Reads the attributes after a tag name like a browser's tokenizer, and restores the case of SVG attribute names.

import { decodeEntities } from './entities.js';

const SVG_ATTRS = ['viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'pathLength', 'spreadMethod', 'textLength', 'lengthAdjust', 'stdDeviation', 'markerWidth', 'markerHeight', 'refX', 'refY', 'startOffset', 'baseFrequency', 'attributeName', 'repeatCount'];
const SVG_ATTR_CASE = new Map(SVG_ATTRS.map(name => [name.toLowerCase(), name]));

export function fixAttrCase(attrs, svg) {
    return attrs.map(([name, value]) => {
        if (!svg) return [name, value];
        if (name === 'xlink:href') return [name, value];
        return [SVG_ATTR_CASE.get(name) ?? name, value];
    });
}

// What a browser's setAttribute takes as a name; anything else a tag holds is junk to skip.
const ATTR_NAME = /^[^\s"'<>/=\u0000-\u001f\u007f-\u009f]+$/;

/**
 * Read attributes after a tag name like a browser's tokenizer: a name runs to whitespace, `/`, `>` or `=`
 * (a leading `=` and stray quotes stay in it); a value is quoted, or runs to whitespace or `>`. Names a
 * browser could not set (`"""`, `'x'`, the `"b"` of `a="1""b"`) are skipped and listed in `junk`.
 * Returns `{ attrs, selfClosing, end, junk }` (end is after `>`); never throws.
 */
export function readAttributes(html, start) {
    const attrs = [];
    const junk = [];
    const seen = new Set();
    let at = start;
    let selfClosing = false;
    while (at < html.length) {
        while (/\s/.test(html[at] ?? '')) at += 1;
        const char = html[at];
        if (char === undefined) break;
        if (char === '>') {
            at += 1;
            return { attrs, selfClosing, end: at, junk };
        }
        if (char === '/') {
            at += 1;
            if (html[at] === '>') {
                selfClosing = true;
                at += 1;
                return { attrs, selfClosing, end: at, junk };
            }
            continue;
        }
        const nameMatch = /^=?[^\s>/=]*/.exec(html.slice(at, at + 1024));
        const raw = nameMatch[0] || char;
        const name = raw.toLowerCase();
        at += raw.length;
        while (/\s/.test(html[at] ?? '')) at += 1;
        let value = '';
        if (html[at] === '=') {
            at += 1;
            while (/\s/.test(html[at] ?? '')) at += 1;
            const quote = html[at];
            if (quote === '"' || quote === '\'') {
                const close = html.indexOf(quote, at + 1);
                value = html.slice(at + 1, close < 0 ? html.length : close);
                at = close < 0 ? html.length : close + 1;
            } else {
                const raw = /^[^\s>]*/.exec(html.slice(at))[0];
                value = raw;
                at += raw.length;
            }
        }
        if (!ATTR_NAME.test(name)) junk.push(raw);
        else if (!seen.has(name)) {
            seen.add(name);
            attrs.push([name, decodeEntities(value)]);
        }
    }
    return { attrs, selfClosing, end: html.length, junk };
}
