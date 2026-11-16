// Which parts of a List of entries play the card roles, and the status values with their tones.
import { defaultTone } from '../block-builder.js';
import { entriesOf } from './shared-entries.js';

// The part names that play a role when the author has not said: Quest, Title or Name → title; the choice → status; Step, Next or Stage → step.
const TITLE_NAMES = /^(title|quest|name|task|goal)\b/i, STEP_NAMES = /(step|next|stage)/i;

/**
 * The card roles for a draft that shows a List of entries as cards: the author's own pick where it still fits the field's parts, else a guess from the
 * names. `step: ''` is the author's "None" and stays. → { roles, guessed } with roles { field, title, status?, step? } or null when there is no list to draw.
 */
export function cardRoles(draft) {
    const lists = entriesOf(draft).filter(field => (field.of ?? []).some(part => part.type === 'text'));
    if (!lists.length) return { roles: null, guessed: false };
    const given = draft.roles ?? {};
    const field = lists.find(item => item.key === given.field) ?? lists[0];
    const parts = field.of ?? [], texts = parts.filter(part => part.type === 'text'), choices = parts.filter(part => part.type === 'choice');
    const own = given.field === field.key;
    const has = (key, type) => parts.some(part => part.key === key && part.type === type);
    let guessed = false;
    // (a role the author set stays while its part is still there and of the right kind; "None" (an empty string) stays too)
    const keep = (key, type, guess, { none = false } = {}) => {
        if (own && none && key === '') return '';
        if (own && has(key, type)) return key;
        guessed = true;
        return guess;
    };
    const title = keep(given.title, 'text', (texts.find(part => TITLE_NAMES.test(part.name)) ?? texts[0]).key);
    const status = keep(given.status, 'choice', choices[0]?.key ?? '', { none: true });
    const step = keep(given.step, 'text', texts.find(part => part.key !== title && STEP_NAMES.test(part.name))?.key ?? '', { none: true });
    return { roles: { field: field.key, title, status, step }, guessed };
}

/** The status values of the roles' choice part, each with the tone it has now (the author's, else the default). */
export function statusTones(draft, roles) {
    const field = entriesOf(draft).find(item => item.key === roles?.field);
    const part = (field?.of ?? []).find(item => item.key === roles?.status && item.type === 'choice');
    const values = Array.isArray(part?.values) ? part.values : String(part?.values ?? '').split(',').map(value => value.trim()).filter(Boolean);
    return values.map(value => ({ value, tone: draft.tones?.[value] ?? defaultTone(value) }));
}
