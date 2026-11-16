// How strongly the pulse shows and the narrator's brief for an invented event.

import { unitOf } from './shared-counts.js';
import { DEFAULT_GROUP } from './place-groups.js';
import { plainSlot } from './slots.js';

export const INTENSITIES = Object.freeze(['around', 'noticed', 'intrusive']);
const INTRUSIVE_BELOW = 0.2;
const NOTICED_BELOW = 0.6;

/**
 * How strongly the pulse shows: 'around' (nearby, noticed or not), 'noticed' (draws a glance) or 'intrusive' (cuts into the scene).
 * From the fractional part of the d20 draw (it picks the row, so no extra draw: the draws never shift): about 1 in 5 intrusive, 2 in 5
 * noticed, 2 in 5 around. Never two intrusive in a row: after `last === 'intrusive'` it is noticed.
 */
export function intensityOf(d20Unit, last = '') {
    const u = unitOf(d20Unit);
    const part = u * 20 - Math.floor(u * 20);
    const level = part < INTRUSIVE_BELOW ? 'intrusive' : part < NOTICED_BELOW ? 'noticed' : 'around';
    return level === 'intrusive' && last === 'intrusive' ? 'noticed' : level;
}

const words = kind => String(kind ?? '').toLowerCase().replaceAll('_', ' ');

/**
 * The note's "World this reply" body when the narrator invents the event: kind, intensity, place group and a short guide, then what happened
 * recently (`recent`: [{ kind, intensity }], newest last, at most 3). Plain text, no braces or markup; `name` (a present person) is offered when
 * the kind is about a person. Short on purpose: the line is in every pulsed reply's note.
 */
export function briefFor({ kind, intensity = 'around', group = DEFAULT_GROUP, name = '', recent = [] } = {}) {
    const past = (Array.isArray(recent) ? recent : []).slice(-3).map(item => `${item.intensity ?? 'around'} ${words(item.kind)}`);
    const who = plainSlot(name, 40);
    return `[${words(kind)}, ${intensity}, ${group}] invent ONE small plausible thing for this place, time and weather from the note's people and threads${who ? ` (${who} may figure)` : ''}; may touch an open thread, then write its change line; 1-2 sentences; never resolve it for the player character; ${past.length ? `not like: ${past.join(', ')}` : 'no repeats'}`;
}
