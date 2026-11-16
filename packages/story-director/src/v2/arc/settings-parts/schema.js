// Arc planning settings defaults, schema, and key namespace.

import { FEATURE } from '../domain.js';
import { DEFAULT_LOW_THREADS, DEFAULT_STALL_DAYS } from '../plan.js';

export const PROMPT_MAX = 12000;
export const NS = 'arc.';

export const DEFAULTS = Object.freeze({
    profile: '',
    trigger: 'manual',
    autoAccept: false,
    genre: '',
    note: '',
    keepNote: false,
    prompt: '',
    recent: 40,
    maxTokens: 1500,
    stallDays: DEFAULT_STALL_DAYS,
    lowThreads: DEFAULT_LOW_THREADS,
});

const field = spec => Object.freeze({ ...spec, feature: FEATURE });

export const SCHEMA = Object.freeze({
    // A Connection Manager profile's name ('' = the chat's own connection); Story Block draws the dropdown.
    profile: field({ type: 'profile', label: 'Arc planning: Planner connection', help: 'The model that plans arcs. Same as chat uses the chat\'s own connection.' }),
    trigger: field({ type: 'choice', label: 'Arc planning: When to plan', options: [{ value: 'manual', label: 'When I press Plan arc' }, { value: 'auto', label: 'By itself (no arc, arc played out, stalled, running low)' }] }),
    // Off by default: a plan waits for the reader's review. On, it is accepted through the same strict reading and commands.
    autoAccept: field({ type: 'bool', label: 'Arc planning: Accept planned arcs automatically', help: 'A planned arc (yours or one planned by itself) is accepted without review; the Director tab notes that an arc began.' }),
    genre: field({ type: 'text', label: 'Arc planning: Genre and tone', max: 200 }),
    note: field({ type: 'text', label: 'Arc planning: Director\'s note (used for one arc)', multiline: true, max: 1000 }),
    keepNote: field({ type: 'bool', label: 'Arc planning: Keep the note for every plan' }),
    recent: field({ type: 'int', label: 'Arc planning: Messages the planner reads', min: 4, max: 200 }),
    maxTokens: field({ type: 'int', label: 'Arc planning: Longest plan (tokens)', min: 300, max: 8000 }),
    stallDays: field({ type: 'int', label: 'Arc planning: Stalled after story days without a beat', min: 1, max: 365 }),
    lowThreads: field({ type: 'int', label: 'Arc planning: Running low below open threads (0: never)', min: 0, max: 20 }),
});
