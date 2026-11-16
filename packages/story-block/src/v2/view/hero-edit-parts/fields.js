// Hero editor: the fields (Story and Character groups) it shows for the hero's props.

import { STRINGS, fill } from '../../../../../../core/strings.js';
import { short, HERE_MAX, NAME_MAX } from './shared-limits.js';
import { timeText, hereNames, hereText } from './time-here.js';
import { clockOf } from './clock.js';

const S = STRINGS.scene;

/** The fields of the editor for the hero's props `p` (`where`, `you`, `clock`, `place`, `weather`). */
export function heroEditFields(p) {
    const where = p?.where && typeof p.where === 'object' ? p.where : {};
    const fields = [];
    const clock = clockOf(p?.clock);
    if (clock) {
        const { parts } = clock;
        const longest = Math.max(...clock.months.map(month => Number(month?.days) || 0), 1);
        fields.push(
            { key: 'year', label: clock.era ? fill(S.fieldYearEra, { era: clock.era }) : S.fieldYear, type: 'number', value: parts ? parts.year : '', soft: true, group: S.groupStory, row: 'date' },
            {
                key: 'month', label: S.fieldMonth, type: 'choice', value: parts ? parts.month : '', group: S.groupStory, row: 'date',
                options: [...(parts ? [] : [{ value: '', label: '—' }]), ...clock.months.map((month, at) => ({ value: at + 1, label: short(month?.name, 40) || String(at + 1) }))],
            },
            { key: 'day', label: S.fieldDay, type: 'number', value: parts ? parts.day : '', min: 1, max: longest, soft: true, group: S.groupStory, row: 'date' },
            { key: 'time', label: S.fieldTime, type: 'time', value: parts ? timeText(parts.minutes) : '', group: S.groupStory, row: 'date' },
        );
    }
    const places = (Array.isArray(where.places) ? where.places : []).map(item => short(typeof item === 'string' ? item : item?.name, NAME_MAX)).filter(Boolean);
    fields.push({ key: 'place', label: S.fieldPlace, type: 'text', value: short(where.place, NAME_MAX) || short(p?.place, NAME_MAX), options: places, maxLength: NAME_MAX, group: S.groupStory });
    if (where.weatherOn !== false) fields.push({ key: 'weather', label: S.fieldWeather, type: 'text', value: short(where.weatherText, 60) || short(p?.weather, 60), maxLength: 60, group: S.groupStory });
    fields.push({ key: 'here', label: S.fieldHere, type: 'text', value: hereText(hereNames(hereText(where.present))), maxLength: HERE_MAX * (NAME_MAX + 2), group: S.groupStory });
    const you = p?.you && typeof p.you === 'object' ? p.you : null;
    if (you) {
        const rankLabel = short(you.rankLabel, 30);
        if (rankLabel) fields.push({ key: 'rank', label: rankLabel, type: 'text', value: typeof you.rank === 'string' ? you.rank : '', maxLength: 120, group: S.groupCharacter });
        fields.push(
            { key: 'wearing', label: S.fieldWearing, type: 'text', value: typeof you.wearing === 'string' ? you.wearing : '', maxLength: 120, group: S.groupCharacter },
            { key: 'condition', label: S.fieldCondition, type: 'text', value: typeof you.condition === 'string' ? you.condition : '', maxLength: 120, group: S.groupCharacter },
        );
    }
    return fields;
}
