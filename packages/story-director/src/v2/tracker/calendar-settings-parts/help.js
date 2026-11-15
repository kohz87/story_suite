// Story Director v2, tracker part: the help words that say where the calendar in use comes from.

import { packCalendarFields } from './fields.js';

/** The pack's name for the calendar's `pack` id (`packs.list` rows), else the id. */
export function packName(list, id) {
    const found = (Array.isArray(list) ? list : []).find(entry => entry?.id === id);
    return String(found?.name || id || 'the pack');
}

/**
 * The Calendar choice's help for `preset` with the pack calendar `calendar` (or null) named `name`:
 * where the calendar in use comes from, in one sentence or two.
 */
export function presetHelp(preset, calendar, name = '') {
    const fields = packCalendarFields(calendar);
    const what = fields ? `${fields.era ? `${fields.era}, ` : ''}${fields.months.length} month${fields.months.length === 1 ? '' : 's'}` : '';
    if (preset === 'gregorian') return 'The built-in Gregorian calendar. The fields below are used only with Custom.';
    if (preset === 'custom') return fields ? `Your own calendar, from the fields below. A field you have not changed shows the pack's (${name}).` : 'Your own calendar, from the fields below.';
    return fields
        ? `From the pack: ${name} (${what}), shown below. Switch to Custom to edit it.`
        : 'No enabled pack has a calendar: the built-in Gregorian, shown below. Switch to Custom to edit it.';
}

/** A calendar field's help: read-only words unless the calendar is Custom. */
export function fieldHelp(preset, calendar) {
    if (preset === 'custom') return '';
    return packCalendarFields(calendar) && preset !== 'gregorian' ? 'The pack\'s, while Calendar is pack: switch to Custom to edit.' : 'Used only when Calendar is Custom.';
}
