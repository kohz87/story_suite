// The core part for the deferred `people` domain: its `people.mirror` command (refused while the flag is off, on a head that moved, or for a bad view)
// and its `people.mirrorOn` / `people.hash` queries. With the flag off nothing creates, saves or reads the domain.

import { hashJson } from '../../replay.js';
import { FLAGS } from '../../flags.js';
import { isPeopleView, validatePeople } from './validate.js';

export const PEOPLE_DOMAIN = 'people';
export const PEOPLE_FLAG = FLAGS.peopleInStore;

const clone = value => JSON.parse(JSON.stringify(value));

/** `flagOn(name)` → boolean: whether a rollout flag is on (read at each call). */
export function createPeoplePart({ flagOn = () => false } = {}) {
    const on = () => { try { return flagOn(PEOPLE_FLAG) === true; } catch { return false; } };
    return {
        domains: { [PEOPLE_DOMAIN]: { initial: () => ({ v: 1, order: [], npcs: {} }), deferred: true, snapshot: 'when-present', validate: validatePeople } },
        commands: {
            // Replaces the people draft with the view, for the reply the view was published at (`source`: { sid, swipeKey }).
            'people.mirror': {
                internal: false,
                handler(ctx, payload) {
                    if (!on()) return ctx.fail('OFF', 'The people store is off; nothing was stored.');
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
            'people.mirrorOn': () => on(),
            // The hash of the stored people slice (null while the domain is absent), to compare with a view's.
            'people.hash': state => (state?.domains?.[PEOPLE_DOMAIN] === undefined ? null : hashJson(state.domains[PEOPLE_DOMAIN])),
        },
    };
}
