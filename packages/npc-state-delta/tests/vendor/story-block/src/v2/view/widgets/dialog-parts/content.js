// Story Suite v2: the actions and paragraphs a dialog draws, as cleaned from its props.

import { str } from '../dom.js';
import { short } from './shared-text.js';

export const ACTION_MAX = 4;
export const ACTION_KINDS = Object.freeze(['primary', 'plain', 'danger']);
/** The actions as drawn: at most ACTION_MAX, each { id, label, kind, icon }; one without a label is left out. */
export function dialogActions(list) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
        if (!raw || typeof raw !== 'object') continue;
        const label = short(raw.label, 40);
        if (!label) continue;
        out.push({ id: short(raw.id, 64) || label, label, kind: ACTION_KINDS.includes(raw.kind) ? raw.kind : 'plain', icon: typeof raw.icon === 'string' ? raw.icon : '' });
        if (out.length >= ACTION_MAX) break;
    }
    return out;
}

/** The paragraphs of a text: blank-line separated, whitespace tidied, at most 8 of 600 characters. */
export function dialogParagraphs(text) {
    return str(text).split(/\n\s*\n/).map(part => short(part, 600)).filter(Boolean).slice(0, 8);
}
