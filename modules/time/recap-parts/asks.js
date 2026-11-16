// v1's While away asks in v2's change-line forms.

import { AWAY_ARRIVAL, AWAY_DEADLINE, AWAY_RECORD } from '../../world/note.js';

// v1's asks name a record bare ("! Key — …"); every v2 line names its kind.
export const AWAY_RECORD_V2 = 'Record each with ! <its kind> Key — what came of it.';
export const AWAY_ARRIVAL_V2 = 'An arrival: ~ <its kind> Key — now: where it is.';
export const AWAY_DEADLINE_V2 = 'A passed deadline: - quest Key — failed, or ~ quest Key — due: later if it still stands.';

/** v1's While away text in v2's change-line forms. */
export function v2Asks(text) {
    return String(text ?? '')
        .replace(AWAY_RECORD, AWAY_RECORD_V2)
        .replace(AWAY_ARRIVAL, AWAY_ARRIVAL_V2)
        .replace(AWAY_DEADLINE, AWAY_DEADLINE_V2);
}
