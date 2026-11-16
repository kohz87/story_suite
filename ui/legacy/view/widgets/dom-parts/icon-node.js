// Builds a decorative icon node from an icon id, a Font Awesome class, an image URL or a glyph.

import { hasIcon, svgIcon } from '../../icons/index.js';
import { h } from './elements.js';
import { faClasses, safeImageUrl } from './images.js';

export const DEFAULT_FA_ICON = 'fa-table-columns';

/**
 * An icon node from a `ph-*` icon id (view/icons, `ph-name:fill` for the solid weight), a Font Awesome class name,
 * a data:/https: image, or a short glyph (an emoji, a letter); null when the value is none of these. An unknown
 * `ph-*` id falls back to the default Font Awesome icon. Icons are decorative: the label lives next to them.
 */
export function iconNode(doc, value, className = 'ss-w-icon') {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed && hasIcon(trimmed)) return svgIcon(doc, trimmed, { className });
    if (trimmed.startsWith('ph-')) {
        const node = h(doc, 'i', `${className ? `${className} ` : ''}fa-solid ${DEFAULT_FA_ICON}`);
        node.setAttribute('aria-hidden', 'true');
        return node;
    }
    const fa = faClasses(value);
    if (fa) {
        const node = h(doc, 'i', `${className} ${fa.join(' ')}`);
        node.setAttribute('aria-hidden', 'true');
        return node;
    }
    const url = safeImageUrl(value);
    if (url) {
        const node = h(doc, 'img', `${className} ss-w-icon-img`);
        node.setAttribute('src', url);
        node.setAttribute('alt', '');
        node.setAttribute('aria-hidden', 'true');
        node.setAttribute('draggable', 'false');
        return node;
    }
    const glyph = typeof value === 'string' ? value.trim() : '';
    if (glyph && Array.from(glyph).length <= 3 && !/^(?:[a-z]+:|\/|\.)/i.test(glyph)) {
        const node = h(doc, 'span', `${className} ss-w-icon-text`, glyph);
        node.setAttribute('aria-hidden', 'true');
        return node;
    }
    return null;
}
