// The present scene model: the now lines of the present cards and the shaped model with its signature.
import { trimAtWord } from '../../npc-api/text.js';
import { DOSSIER_LOOK_LABEL, NOW_PARTS, NOW_PART_MAX, NOW_TITLE_MAX } from './now-constants.js';
import { plain } from './shared-text.js';

/** The labelled now lines with a value, in order: [{ key, label, text, title }], cut at a word. */
export function nowParts(source = {}) {
    const values = source && typeof source === 'object' ? source : {};
    return NOW_PARTS.map(([key, label]) => {
        const value = plain(values[key]);
        return value ? { key, label, text: trimAtWord(value, NOW_PART_MAX), title: trimAtWord(value, NOW_TITLE_MAX) } : null;
    }).filter(Boolean);
}

function signatureOf(value) {
    const text = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

/**
 * What the present view shows beyond the cards themselves.
 * `cards`: [{ id, name, aliases, mood, condition, outfit }] (Delta's own tracked values).
 * Returns { now: { [id]: { parts: [{ key, label, text, title }] } }, texts: [string], signature }
 * where every `text`/`title` is an index into `texts`. Never throws.
 */
export function presentSceneModel({ cards = [] } = {}) {
    const texts = [];
    const slot = value => texts.push(String(value)) - 1;
    const model = { now: {}, texts, signature: '' };
    try {
        const list = (Array.isArray(cards) ? cards : []).filter(card => card && plain(card.id));
        for (const card of list) {
            const parts = nowParts(card);
            if (parts.length) {
                // The third line is the NPC's current look (appearance or form), not only clothes: "Look" (1.2.8).
                model.now[plain(card.id)] = {
                    parts: parts.map(part => ({ key: part.key, label: part.key === 'outfit' ? DOSSIER_LOOK_LABEL : part.label, text: slot(part.text), title: slot(part.title) })),
                };
            }
        }
    } catch (error) {
        console.warn('[NPC State Delta] present scene could not be shaped', error);
        model.now = {};
        texts.length = 0;
    }
    model.signature = signatureOf([model.now, texts]);
    return model;
}
