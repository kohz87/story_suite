// The time part's registration: its commands, queries, context tail, hooks, features and settings.

import { RECAP_BUDGET } from '../recap.js';
import { DEFAULTS } from '../records.js';
import { ADVANCE, advanceCommand } from '../advance.js';
import { WEATHER_FEATURE, weatherHook } from '../weather.js';
import { SETTLE, beforeGenerate, settleCommand } from './settle-hook.js';
import { timeTail } from './tail.js';
import { queries } from './queries.js';

export const part = {
    domains: {},
    commands: { [SETTLE]: settleCommand, [ADVANCE]: advanceCommand },
    queries,
    kinds: {},
    context: {
        // Nothing fixed: the recap carries its own cue, so the static prompt is unchanged.
        static: () => '',
        tail: view => timeTail(view),
        budget: RECAP_BUDGET,
    },
    // Right after a reply's last story line (Story Block's afterCapture): the day's weather by rule (weather.js).
    hooks: { beforeGenerate, afterCapture: Object.assign(view => weatherHook(view), { feature: WEATHER_FEATURE }) },
    // MODULES §F122: the weather from the calendar's season and the region, seeded per story day and region.
    features: [{ id: WEATHER_FEATURE, label: 'Weather from the calendar', describe: 'Each story day gets its weather from the season and the region (a pack may give its own table), so the Status card and the Scene always have one. A ~ weather line the story writes wins for the rest of that day and place.', default: true }],
    settings: {
        section: 'Time',
        defaults: { ...DEFAULTS },
        // The reader's calendar is the tracker part's setting (module.js hands it over as `calendar`).
        reads: { calendar: 'tracker.calendar' },
        schema: {
            recapHours: { type: 'int', label: 'While away recap after a jump of (story hours)', min: 1, max: 720 },
            lapses: { type: 'bool', label: 'Deadlines slip or lapse as story time passes' },
        },
    },
    tabs: [],
};
