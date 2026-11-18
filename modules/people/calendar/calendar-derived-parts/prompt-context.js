/* The one-line grounded world date sentence added to prompts. */

import { normalizeCalendarConfig } from '../calendar-config.js';
import { storyCurrentDate } from '../calendar-clock.js';
import { formatCalendarDate, normalizeCalendarDate } from '../calendar-date.js';

export function calendarPromptContext(config = null, referenceDate = null) {
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    if (!normalized.calendarValid) return '';
    const current = normalizeCalendarDate(referenceDate, normalized.config) || storyCurrentDate(normalized.config);
    return current ? `Current grounded world date=${formatCalendarDate(current, normalized.config)}.` : '';
}
