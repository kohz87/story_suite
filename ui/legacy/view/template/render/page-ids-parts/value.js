// Story Suite v2: the value an attribute is set to in the page (prefixed ids, cleaned classes, reserved names dropped).

import { cleanClasses, RESERVED_NAMES } from '../../sanitize.js';
import { CONTROLS } from '../dom.js';

// Attributes whose value is one id, or a space-separated list of ids, in the same template.
const ID_LISTS = new Set(['for', 'headers', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'aria-flowto']);
export const PAINT_REFS = new Set(['fill', 'stroke', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end', 'filter']);

// `id` as drawn in this view: the screen's prefix, and the copy's mark after the first copy.
const pageId = (view, id) => `${view.idPrefix}${id}${view.copy > 1 ? `--c${view.copy}` : ''}`;

/**
 * The value an attribute is set to in the page: ids and references to them get the screen's prefix, class
 * lists lose reserved classes, reserved control names go. `null` leaves the attribute out.
 */
export function pageValue(view, tag, name, value) {
    const lower = name.toLowerCase();
    if (lower === 'id') return value.trim() ? pageId(view, value.trim()) : null;
    if (ID_LISTS.has(lower)) return value.split(/\s+/).filter(Boolean).map(id => pageId(view, id)).join(' ');
    if ((lower === 'href' || lower === 'xlink:href') && /^\s*#./.test(value)) return `#${pageId(view, value.replace(/^\s*#/, ''))}`;
    if (PAINT_REFS.has(lower)) return value.replace(/url\(\s*(['"]?)\s*#([^)'"\s]*)/gi, (_, quote, id) => `url(${quote}#${pageId(view, id)}`);
    if (lower === 'class') {
        const classes = cleanClasses(value);
        if (classes.dropped.length) view.warn(`The class ${classes.dropped.join(', ')} was left off <${tag}>: SillyTavern acts on it.`);
        return classes.value;
    }
    if (lower === 'name' && tag !== 'ss-widget') {
        if (RESERVED_NAMES.has(value.trim())) {
            view.warn(`name="${value.trim()}" was left off <${tag}>: SillyTavern reads controls by that name.`);
            return null;
        }
        if (tag === 'form' || CONTROLS.has(tag)) return value.trim() ? pageId(view, value.trim()) : null;
    }
    return value;
}
