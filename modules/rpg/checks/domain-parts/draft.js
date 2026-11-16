// The checks draft every writer uses.

import { LEGACY_POLICY } from './shared-legacy.js';
import { isRecord } from './shared-record.js';

/** The checks draft every writer uses, without the retired policy field. */
export function draftChecks(ctx) {
    const draft = ctx.draft('checks');
    if (isRecord(draft.policy)) delete draft.policy[LEGACY_POLICY];
    return draft;
}
