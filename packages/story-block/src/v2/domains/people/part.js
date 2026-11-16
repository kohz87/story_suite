// The core part for the `people` domain: a core domain present from the first reply of a new chat, its internal `people.write` command (refused on a head
// that moved or for a bad view) and its `people.hash` query. The part reads no flag. The command stores the view as leaf ops inside the reply's transaction.

import { hashJson } from '../../replay.js';
import { isPeopleView, validatePeople } from './validate.js';

export const PEOPLE_DOMAIN = 'people';

const clone = value => JSON.parse(JSON.stringify(value));

export function createPeoplePart() {
    return {
        domains: { [PEOPLE_DOMAIN]: { initial: () => ({ v: 1, order: [], npcs: {} }), deferred: true, snapshot: 'when-present', validate: validatePeople } },
        commands: {
            // Replaces the people draft with the view, for the reply the view belongs to (`source`: { sid, swipeKey }); the store diffs it into leaf ops.
            'people.write': {
                internal: false,   // (sent through the public sdk by the sender; it is stored on the reply's carrier)
                handler(ctx, payload) {
                    const view = payload?.view;
                    if (!isPeopleView(view)) return ctx.fail('INVALID', 'The people view is not sound; nothing was stored.');
                    const asked = payload?.source;
                    const here = ctx.source;
                    if (!here || !asked || asked.sid !== here.sid || (asked.swipeKey !== undefined && asked.swipeKey !== here.swipeKey)) {
                        return ctx.fail('STALE', 'The story moved on before the people were stored; nothing was stored.');
                    }
                    const draft = ctx.draft(PEOPLE_DOMAIN);
                    for (const key of Object.keys(draft)) delete draft[key];
                    Object.assign(draft, clone(view));
                    return { summary: 'People stored.', narrate: false };
                },
            },
        },
        queries: {
            // The hash of the stored people slice, to compare with a view's.
            'people.hash': state => (state?.domains?.[PEOPLE_DOMAIN] === undefined ? null : hashJson(state.domains[PEOPLE_DOMAIN])),
        },
    };
}
