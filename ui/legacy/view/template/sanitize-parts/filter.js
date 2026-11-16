// Story Suite v2: filtering parsed template nodes and their attributes through the allow-list.

import { filterDeclarations } from '../../css.js';
import { HTML_TAGS, SVG_TAGS, DROP_WITH_CONTENT } from './tags.js';
import { PAINT_ATTRS } from './paint.js';
import { cleanClasses, RESERVED_NAMES } from './reserved.js';
import { TYPE_MARK } from './control-types.js';
import { attrAllowed } from './attrs.js';
import { isUrlAttr, urlAllowed } from './urls.js';

const BUTTON_TYPES = ['button', 'submit', 'reset'];
const INPUT_TYPES = new Set(['text', 'number', 'range', 'checkbox', 'radio', 'search', 'color', 'hidden', 'submit', 'reset', 'button', 'email', 'tel', 'date', 'time']);

/** Filter parsed nodes through the allow-list. Returns `{ nodes, warnings }`. */
export function filterNodes(nodes, warnings = []) {
    const out = [];
    for (const node of nodes) {
        if (node.type === 'text') {
            out.push({ type: 'text', text: node.text });
            continue;
        }
        const { tag, svg } = node;
        if (DROP_WITH_CONTENT.has(tag) && !(svg && tag === 'title')) {
            warnings.push(`Removed <${tag}>: not allowed in a screen.`);
            continue;
        }
        const known = svg ? SVG_TAGS.has(tag) : HTML_TAGS.has(tag);
        const children = filterNodes(node.children, warnings).nodes;
        if (!known) {
            warnings.push(`Removed <${tag}> (its content kept): not an allowed element.`);
            out.push(...children);
            continue;
        }
        out.push({ type: 'element', tag, svg, attrs: filterAttrs(tag, svg, node.attrs, warnings), children });
    }
    return { nodes: out, warnings };
}

function filterAttrs(tag, svg, attrs, warnings) {
    const out = [];
    // TYPE_MARK (markControlTypes, before DOMPurify) is the control's `type`; one type per control, the first.
    const typed = !svg && (tag === 'input' || tag === 'button');
    let hasType = false;
    for (let [name, value] of attrs) {
        if (typed && (name.toLowerCase() === TYPE_MARK || name.toLowerCase() === 'type')) {
            if (hasType) continue;
            hasType = true;
            name = 'type';
        }
        if (!attrAllowed(tag, svg, name)) {
            warnings.push(`Removed ${name} from <${tag}>.`);
            continue;
        }
        if (isUrlAttr(name) && !urlAllowed(tag, name, value)) {
            warnings.push(PAINT_ATTRS.has(name.toLowerCase())
                ? `Removed ${name} from <${tag}>: only a colour or url(#id) is allowed.`
                : `Removed ${name} from <${tag}>: only https: (and data: images) are allowed.`);
            continue;
        }
        if (name === 'class' && !value.includes('{{')) {   // a class list with {{ }} is checked when drawn
            const classes = cleanClasses(value);
            if (classes.dropped.length) warnings.push(`Removed the class ${classes.dropped.join(', ')} from <${tag}>: SillyTavern acts on it.`);
            if (classes.value) out.push([name, classes.value]);
            continue;
        }
        if (name === 'name' && tag !== 'ss-widget' && RESERVED_NAMES.has(value.trim())) {
            warnings.push(`Removed name="${value.trim()}" from <${tag}>: SillyTavern reads controls by that name.`);
            continue;
        }
        if (name === 'style') {
            if (value.includes('{{')) warnings.push(`<${tag}> style is not bound: use data-bind-var and CSS variables.`);
            const filtered = filterDeclarations(value.replace(/\{\{[\s\S]*?\}\}/g, ''), { where: `<${tag}> style` });
            warnings.push(...filtered.warnings);
            if (filtered.text) out.push([name, filtered.text]);
            continue;
        }
        if (tag === 'input' && name === 'type') {
            const type = value.trim().toLowerCase();
            if (type === 'image' || type === 'file') {
                warnings.push(`Removed <input type="${type}">'s type.`);
                continue;
            }
            out.push([name, INPUT_TYPES.has(type) ? type : 'text']);
            continue;
        }
        if (tag === 'button' && name === 'type') {
            const type = value.trim().toLowerCase();
            out.push([name, BUTTON_TYPES.includes(type) ? type : 'button']);
            continue;
        }
        if (tag === 'a' && name === 'target') {
            if (value.trim() === '_blank') out.push([name, '_blank']);
            continue;
        }
        if (tag === 'a' && name === 'rel') continue;
        out.push([name, value]);
    }
    if (tag === 'a' && out.some(([name]) => name === 'target')) out.push(['rel', 'noopener noreferrer']);
    return out;
}
