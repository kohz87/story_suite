// The Level a `~ npc` line may state outright (`~ npc Mira | level: 5`), only while the custom Level field is on and lines mode is on (labels.js reads the label then).
// It is stored on the person's Level custom field (people.fields writes it). A line never lowers a level, never replaces a rank or other words the field holds,
// and never touches a person whose custom fields the reader locked by hand. Reads the dossier the reply sees (reply-pinned), so a swipe, a Re-read and a replay agree.
import { clean } from '../npc-meters-config.js';

const WHOLE = /^\d{1,3}$/;

/** → { set: { level? }, problems }; `held`: the dossier record; the number is 1 to 99, as the RPG reader takes a stated Level. */
export function levelField(fields, held) {
    if (fields.level === undefined) return { set: {}, problems: [] };
    const text = clean(fields.level, 40);
    const value = WHOLE.test(text) ? Number(text) : 0;
    if (value < 1 || value > 99) return { set: {}, problems: [`level: "${clean(fields.level, 40)}" is not a whole number from 1 to 99; not used.`] };
    if ((Array.isArray(held?.manualProfileFields) ? held.manualProfileFields : []).includes('customFields')) return { set: {}, problems: ['level is locked by you; not changed.'] };
    const key = Object.keys(held?.customFields && typeof held.customFields === 'object' ? held.customFields : {}).find(name => name.toLowerCase() === 'level');
    const now = String(key ? held.customFields[key] : '').trim();
    if (!now) return { set: { level: String(value) }, problems: [] };
    if (!WHOLE.test(now)) return { set: {}, problems: [`level is already "${clean(now, 40)}"; a line does not change it.`] };
    if (value > Number(now)) return { set: { level: String(value) }, problems: [] };
    return { set: {}, problems: value < Number(now) ? [`level is already ${Number(now)}; a line never lowers it.`] : [] };
}
