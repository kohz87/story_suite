// Story Director v2, names: the names in use around the scene, the suggestions for a new person and a stored profile.

import { cleanName } from './text.js';
import { nameKey, sameName } from './keys.js';
import { profileText } from './profile.js';
import { pickSuggestions } from './suggest.js';
import { MAX_SEEN, MAX_ALIASES } from './slice-limits.js';
import { tables } from './slice-keys.js';
import { settingsOf, packNames } from './feature.js';
import { isRecord, ask, queryOf, namesOf } from './host-read.js';

/** Names and linked aliases from the scene, cast, NPC State Delta and key people; recorded before the reply for replay. */
export function othersOf(view) {
    const query = queryOf(view);
    const cast = view?.state?.domains?.cast?.people;
    const keys = view?.state?.domains?.keypeople;
    const identities = [];
    const add = (source, person, fallback = '') => {
        const name = cleanName(person?.name || fallback), aliases = [...new Set((Array.isArray(person?.aliases) ? person.aliases : []).map(cleanName).filter(alias => nameKey(alias)))].slice(0, MAX_ALIASES);
        if (nameKey(name)) identities.push({ source: source.slice(0, 200), name, aliases });
    };
    const known = namesOf(ask(query, 'npc.known')).slice(0, MAX_SEEN);
    for (const name of known) {
        const dossier = ask(query, 'npc.dossier', { name });
        const id = ask(query, 'npc.identity', { name })?.id;
        add(`npc:${typeof id === 'string' ? id : nameKey(name)}`, dossier, name);
    }
    for (const [key, person] of Object.entries(isRecord(cast) ? cast : {})) add(`cast:${key}`, person);
    for (const [key, person] of Object.entries(isRecord(keys?.pins) ? keys.pins : {})) add(`pin:${key}`, person);
    const names = [...namesOf(ask(query, 'scene.present')), ...known, ...identities.flatMap(person => [person.name, ...person.aliases]), ...Object.values(isRecord(keys?.gone) ? keys.gone : {}).map(entry => entry?.name)].filter(name => typeof name === 'string' && nameKey(name));
    return { names, identities };
}
export const suggestionsFor = (view, slice, count, seed) => {
    const { people, seen } = tables(slice);
    const names = packNames(queryOf(view));
    const settings = settingsOf(view);
    return names ? pickSuggestions({ names, region: view?.state?.domains?.scene?.place?.region ?? '', used: [...Object.values(people), ...Object.values(seen)].flatMap(entry => [entry.name, ...(entry.aliases ?? [])]).concat(othersOf(view).names), banned: settings.banned, count, seed }) : [];
};
/** The stored profile of the person `name` goes by, as `{ name, look, flaw, voice, temper, text }`, or null. */
export function profileOf(slice, name) {
    const { people } = tables(slice);
    const entry = Object.hasOwn(people, nameKey(name)) ? people[nameKey(name)] : Object.values(people).find(other => sameName(other.name, name));
    return entry?.profile ? { name: entry.name, ...entry.profile, text: profileText(entry.profile) } : null;
}
