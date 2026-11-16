// Grouping chatter by unmatched speaker and tagging the roster with the model signature.
import { normalizeName } from '../core-mechanics.js';
import { escapeAttr } from './shared-text.js';

/**
 * Chatter from named speakers with no present card (1.2.7), one group per speaker in the order
 * they first speak: [{ speaker, name, lines: [{ order, text }] }], `speaker` and `text` text
 * slots, `name` the plain name (for matching a dossier, never for markup). Lines with no
 * speaker are left to othersSlotsHtml.
 */
export function speakerGroups(model) {
    const groups = new Map();
    for (const other of Array.isArray(model?.others) ? model.others : []) {
        if (other?.speaker === null || other?.speaker === undefined) continue;
        const name = String(model.texts?.[other.speaker] ?? '');
        const key = normalizeName(name);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, { speaker: other.speaker, name, lines: [] });
        groups.get(key).lines.push({ order: other.order, text: other.text });
    }
    return [...groups.values()];
}

/** The roster attribute that ties rendered slots to their model. */
export function sceneAttr(model) {
    return model?.signature ? ` data-delta-scene="${escapeAttr(model.signature)}"` : '';
}
