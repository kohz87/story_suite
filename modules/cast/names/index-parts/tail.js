// Story Director v2, names: `context.tail`: the profiles of stored people back in the scene, then the name suggestions.

import { cutPoints } from './text.js';
import { sameName } from './keys.js';
import { PROFILE_FIELDS, MAX_PROFILE } from './profile-limits.js';
import { tables } from './slice-keys.js';
import { namesOn, settingsOf } from './feature.js';
import { suggestionsFor } from './scene.js';
import { ask, queryOf, namesOf } from './host-read.js';

const MAX_TAIL_PROFILES = 4;
const TAIL_HEADER = 'Unused names (pick one for any new person):';

/** `context.tail(view)` → `{ lines, optional }`: the profiles of the stored people who are back in the scene, then the suggestions (optional lines). */
export function tail(view) {
    if (!namesOn(view)) return { lines: [], optional: [] };
    const slice = view?.state?.domains?.names;
    const settings = settingsOf(view);
    const present = namesOf(ask(queryOf(view), 'scene.present'));
    const chat = view?.story?.chat?.();
    const last = String((Array.isArray(chat) ? chat.findLast(message => message && !message.is_user) : null)?.mes ?? '');
    const named = name => new RegExp(`(?<![\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu').test(last);
    const optional = Object.values(tables(slice).people)
        .filter(entry => entry.profile && (present.some(name => sameName(name, entry.name)) || (last && named(entry.name))))
        .slice(0, MAX_TAIL_PROFILES).map(entry => cutPoints(`${entry.name}: ${PROFILE_FIELDS.map(field => entry.profile[field]).filter(Boolean).join('; ')}`, MAX_PROFILE));
    const picks = suggestionsFor(view, slice, settings.count, `${view?.chat?.length ?? 0}`);
    if (picks.length) optional.push(`${TAIL_HEADER} ${picks.join(', ')}`);
    return { lines: [], optional };
}
