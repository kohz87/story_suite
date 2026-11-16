// Cast settings defaults and UI schema.

import { DEFAULT_FACES, FACES, FEATURE } from '../domain.js';

export { FEATURE };

export const DEFAULTS = Object.freeze({ on: true, faces: DEFAULT_FACES, unmetDie: false, profile: '' });

const field = spec => Object.freeze({ ...spec, feature: FEATURE, group: 'The cast' });

export const SCHEMA = Object.freeze({
    on: field({ type: 'bool', label: 'The pack\'s cast lives off-screen', help: 'People a pack lists move on while you are elsewhere, and you meet them by place and routine, or when their goal leads them to you. Off: nobody moves or arrives; what is kept stays.' }),
    faces: field({
        // Compact pills (Story Block's segmented choice); a host without it draws the same choice as a dropdown.
        type: 'choice', form: 'segmented', label: 'New faces at most',
        options: Object.entries(FACES).map(([value, face]) => ({ value, label: face.label })),
        help: 'You meet someone the first time you are at their place while they are there, or when their goal leads them to you. This keeps it to a few at a time; the rest wait. Never during a fight.',
    }),
    unmetDie: field({ type: 'bool', label: 'Unmet cast can die off-screen', help: 'Off: before you meet them they can be hurt, lose things or move, but not die. A pack entry can still mark someone as able to die.' }),
    profile: field({ type: 'profile', label: 'Planner connection', help: 'The model that moves the cast when a day passes. They move only when the day changes or time skips: one short planner line each, only where something changed. Same as chat uses the chat\'s own connection.' }),
});
