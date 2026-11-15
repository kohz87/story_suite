// The two d20 tables: rows by range.

import { STANDARD, DUO } from './table-ids.js';

const row = (from, to, kind) => Object.freeze({ from, to, kind });

/** The two tables: rows by d20 range, 1 to 20 with no gap. */
export const TABLES = Object.freeze({
    [STANDARD]: Object.freeze({
        id: STANDARD,
        title: 'Standard',
        rows: Object.freeze([
            row(1, 2, 'CALM'),
            row(3, 4, 'ENTER_CHECK'),
            row(5, 6, 'BACKGROUND_INCIDENT'),
            row(7, 8, 'MOOD_SWING'),
            row(9, 10, 'GOSSIP_SURGE'),
            row(11, 12, 'CHANCE_MEETING'),
            row(13, 14, 'OVERHEARD_DETAIL'),
            row(15, 16, 'TASK_SHIFT'),
            row(17, 18, 'MUNDANE_INTERRUPTION'),
            row(19, 20, 'CALM'),
        ]),
    }),
    [DUO]: Object.freeze({
        id: DUO,
        title: 'Duo',
        rows: Object.freeze([
            row(1, 2, 'CALM'),
            row(3, 4, 'ENV_SHIFT'),
            row(5, 6, 'MOOD_SWING'),
            row(7, 8, 'PHYSICAL_REACTION'),
            row(9, 10, 'MEMORY_TRIGGER'),
            row(11, 12, 'OBJECT_DISCOVERY'),
            row(13, 14, 'OUTSIDE_INTRUSION'),
            row(15, 16, 'POWER_SHIFT'),
            row(17, 18, 'MUNDANE_INTERRUPTION'),
            row(19, 20, 'CALM'),
        ]),
    }),
});
