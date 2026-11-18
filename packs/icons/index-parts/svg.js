// Icons: the inline SVG builder for the `ph-*` set, and the check whether an id is one of them.

import { ICON_SET } from '../set.js';
import { WEIGHTS, parse } from './shared-parse.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** True when `value` is a known `ph-*` id (with or without `:fill`). */
export function hasIcon(value) {
    return parse(value) !== null;
}

/**
 * An inline `<svg class="ss-icon-svg">` (viewBox 0 0 256 256, one path, fill currentColor, aria-hidden, not focusable,
 * 1em square) for `value` (`ph-name` or `ph-name:fill`); `weight` picks the solid one too. Null for an unknown id.
 */
export function svgIcon(doc, value, { weight = '', className = '' } = {}) {
    const found = parse(value);
    if (!found) return null;
    const use = WEIGHTS.includes(weight) ? weight : found.weight;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    const extra = typeof className === 'string' ? className.trim() : '';
    svg.setAttribute('class', extra ? `${extra} ss-icon-svg` : 'ss-icon-svg');
    svg.setAttribute('viewBox', '0 0 256 256');
    svg.setAttribute('width', '1em');
    svg.setAttribute('height', '1em');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('data-icon', found.id);
    svg.setAttribute('data-weight', use);
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICON_SET[found.id][use]);
    svg.appendChild(path);
    return svg;
}
