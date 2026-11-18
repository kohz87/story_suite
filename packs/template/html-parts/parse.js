// Parses template HTML into nodes (with the nesting depth limit); the tolerant tree builder.

import { RAW, RCDATA, SVG_TAG_CASE, VOID } from './tags.js';
import { decodeEntities } from './entities.js';
import { implicitEnds } from './implicit-ends.js';
import { fixAttrCase, readAttributes } from './attributes.js';

const TABLE_SCOPE = new Set(['table', 'td', 'th', 'caption']);
const TABLE_TAGS = new Set(['table', 'caption', 'colgroup', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th']);

// How deep elements may nest. Every step after parsing (the allow-list, compiling, drawing) walks the
// tree one level per call, so a deeper template would end in "Maximum call stack size exceeded" at
// every draw; packs refuse one (packs/validate.js), and the parser flattens what lies deeper.
export const MAX_DEPTH = 64;

/** True when `source` nests elements deeper than MAX_DEPTH (what parseHtml would flatten). */
export function tooDeep(source) {
    const info = { flattened: 0 };
    parseHtml(source, null, info);
    return info.flattened > 0;
}

/**
 * Parse template HTML into nodes. `warnings`, when given, collects a plain sentence for each attribute
 * that was skipped because a browser could not set it (`<img """>`, `<p a="1""b">`), and one when
 * elements nested past MAX_DEPTH were flattened (their tags left out, their content kept);
 * `info.flattened` counts those tags.
 */
export function parseHtml(source, warnings = null, info = null) {
    const html = String(source ?? '');
    const root = { type: 'element', tag: '#root', svg: false, attrs: [], children: [] };
    const stack = [root];
    let excess = 0;   // open tags left out below MAX_DEPTH, whose end tags are skipped too
    const current = () => stack[stack.length - 1];
    const inSvg = () => stack.some(node => node.tag === 'svg');
    const pushText = text => {
        if (!text) return;
        const parent = current();
        const last = parent.children[parent.children.length - 1];
        if (last?.type === 'text') last.text += text;
        else parent.children.push({ type: 'text', text });
    };
    const closeTo = tag => {
        for (let i = stack.length - 1; i > 0; i -= 1) {
            if (stack[i].tag === tag) {
                stack.length = i;
                return true;
            }
            // An end tag does not reach out of a table cell, a table or an svg (an unmatched one is ignored).
            if (stack[i].tag === 'svg' || (TABLE_SCOPE.has(stack[i].tag) && !TABLE_TAGS.has(tag))) return false;
        }
        return false;
    };
    let at = 0;
    while (at < html.length) {
        const lt = html.indexOf('<', at);
        if (lt < 0) {
            pushText(decodeEntities(html.slice(at)));
            break;
        }
        if (lt > at) pushText(decodeEntities(html.slice(at, lt)));
        at = lt;
        const rest = html.slice(at, at + 2);
        if (html.startsWith('<!--', at)) {
            const end = html.indexOf('-->', at + 4);
            at = end < 0 ? html.length : end + 3;
            continue;
        }
        if (rest === '<!' || rest === '<?') {
            const cdata = html.startsWith('<![CDATA[', at) ? html.indexOf(']]>', at) : -1;
            const end = cdata >= 0 ? cdata + 2 : html.indexOf('>', at);
            at = end < 0 ? html.length : end + 1;
            continue;
        }
        if (rest === '</') {
            const match = /^<\/([A-Za-z][^\s/>]*)[^>]*>?/.exec(html.slice(at));
            if (!match) {
                // `</` not followed by a name: a bogus comment in HTML; skip to `>`.
                const end = html.indexOf('>', at);
                at = end < 0 ? html.length : end + 1;
                continue;
            }
            at += match[0].length;
            if (excess) {
                excess -= 1;
                continue;
            }
            const name = match[1].toLowerCase();
            const tag = inSvg() ? SVG_TAG_CASE.get(name) ?? name : name;
            closeTo(tag);
            continue;
        }
        const open = /^<([A-Za-z][^\s/>]*)/.exec(html.slice(at));
        if (!open) {
            pushText('<');
            at += 1;
            continue;
        }
        at += open[0].length;
        const { attrs, selfClosing, end, junk } = readAttributes(html, at);
        if (junk.length && Array.isArray(warnings)) warnings.push(`Skipped ${junk.map(name => name.slice(0, 40)).join(' ')} in <${open[1].toLowerCase()}>: not an attribute name a browser can set.`);
        at = end;
        const lower = open[1].toLowerCase();
        if (stack.length > MAX_DEPTH && !VOID.has(lower) && !RAW.has(lower) && !RCDATA.has(lower) && !selfClosing) {
            if (!excess && !info?.flattened && Array.isArray(warnings)) warnings.push(`Elements nested more than ${MAX_DEPTH} deep were flattened: their tags were left out, their content kept.`);
            excess += 1;
            if (info) info.flattened = (info.flattened ?? 0) + 1;
            continue;
        }
        const svg = inSvg() || lower === 'svg';
        const tag = svg ? SVG_TAG_CASE.get(lower) ?? lower : lower;
        const element = { type: 'element', tag, svg, attrs: fixAttrCase(attrs, svg), children: [] };
        if (!svg) implicitEnds(tag, stack);
        if (!svg && tag === 'tr' && current().tag === 'table') {
            const body = { type: 'element', tag: 'tbody', svg: false, attrs: [], children: [] };
            current().children.push(body);
            stack.push(body);
        }
        current().children.push(element);
        if (!svg && (RAW.has(tag) || RCDATA.has(tag))) {
            const close = new RegExp(`</${tag}(?=[\\s/>])[^>]*>|</${tag}$`, 'i').exec(html.slice(at));
            const body = close ? html.slice(at, at + close.index) : html.slice(at);
            if (body) element.children.push({ type: 'text', text: RCDATA.has(tag) ? decodeEntities(body) : body });
            at = close ? at + close.index + close[0].length : html.length;
            continue;
        }
        if ((VOID.has(tag) && !svg) || (selfClosing && svg)) continue;
        stack.push(element);
    }
    return root.children;
}
