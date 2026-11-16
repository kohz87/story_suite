// Checking the crafts list that recipes use.

import { SLUG, STAT_NAME, CRAFTS_LIMITS, CRAFT_FIELDS, TERM_SEPARATORS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { records, isText } from '../core.js';

const statList = (value, max) => Array.isArray(value) && value.length >= 1 && value.length <= max
    && value.every(stat => typeof stat === 'string' && STAT_NAME.test(stat)) && new Set(value).size === value.length;

// The crafts a pack declares or changes (MODULES §F102): `{ id, title, stats, stations?, note? }`. The id
// is the craft as recipes write it ('alchemy'); one of the default crafts' ids replaces that craft.
export function checkCrafts(list, packId, add) {
    if (Array.isArray(list) && list.length > CRAFTS_LIMITS.records) {
        add('BAD_CONTENT', 'content.crafts', `content.crafts holds at most ${CRAFTS_LIMITS.records} crafts.`);
        return [];
    }
    return records(list, 'crafts', { add, packId, slugField: 'id', named: false, check: (record, path) => {
        const label = typeof record.id === 'string' ? `Craft "${record.id}"` : path;
        let ok = true;
        const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
        for (const key of Object.keys(record)) if (!CRAFT_FIELDS.includes(key)) say(key, `"${key}" is not a craft field (expected ${CRAFT_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (typeof record.title !== 'string' || !record.title.trim() || oneLine(record.title).length > CRAFTS_LIMITS.title) say('title', `title must be the craft's name, 1 to ${CRAFTS_LIMITS.title} characters (like "Alchemy").`);
        else if (TERM_SEPARATORS.test(record.title)) say('title', 'title may not hold | : # < > or a line break.');
        if (!statList(record.stats, CRAFTS_LIMITS.stats)) say('stats', `stats must list 1 to ${CRAFTS_LIMITS.stats} different stat names the check rolls with: ["INT", "DEX"].`);
        const stations = record.stations ?? [];
        if (!Array.isArray(stations) || stations.length > CRAFTS_LIMITS.stations || stations.some(station => typeof station !== 'string' || !SLUG.test(station)) || new Set(stations).size !== stations.length) {
            say('stations', `stations must list at most ${CRAFTS_LIMITS.stations} different station ids ("forge", "alchemy-table" …); leave it out or [] for anywhere.`);
        }
        const note = record.note ?? '';
        if (!isText(note, CRAFTS_LIMITS.note)) say('note', `note must be text of at most ${CRAFTS_LIMITS.note} characters.`);
        if (!ok) return null;
        return { title: oneLine(record.title), stats: [...record.stats], stations: [...stations], ...(note ? { note } : {}) };
    } });
}
