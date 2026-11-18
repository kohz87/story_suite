// The time part's registration: its commands, queries, context tail, hooks, features and settings.

import { RECAP_BUDGET } from '../recap.js';
import { DEFAULTS } from '../records.js';
import { ADVANCE, advanceCommand } from '../advance.js';
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
    hooks: { beforeGenerate },
    features: [],
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
