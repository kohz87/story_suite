// Filling a fresh dossier from a cast person's pack entry (profile, numbers, hidden notes, castFrom).

import { portraitHasImage } from '../portrait-file.js';
import { PACK_BIRTHDAY_REASON, normalizeBirthDate } from '../../birthday.js';
import { getActiveCalendarConfig, normalizeCalendarConfig } from '../../calendar.js';
import { ALIASES_MAX } from './limits-text.js';
import { castSecrets } from './entry-lists.js';
import { shortPackName } from './dossier-lookup.js';
import { parsePeople } from './people-field.js';
import { isObject, labelKey } from './shared-text.js';

// The writer's birthday, "Month day" or "Month day, year" (Story Block checks it against the pack's calendar), read on the active
// calendar: the date as established, or null when it does not fit that calendar (the dossier then keeps Delta's own date).
// Skipped with a reason when Delta runs its own calendar (`calendarOwn`): the pack's date is in the pack's calendar, which is not
// the active one then, so reading it here would give a wrong date. Delta's own date stands and the story can still state one.
function castBirthday(text, calendarOwn = false) {
    if (calendarOwn) return null;
    const match = /^(.+?)\s+(\d{1,3})(?:,\s*(-?\d{1,9}))?$/u.exec(String(text ?? '').trim());
    if (!match) return null;
    const config = normalizeCalendarConfig(getActiveCalendarConfig(), { requireCurrentDate: false });
    const year = match[3] === undefined ? null : Number(match[3]);
    return normalizeBirthDate({ era: year === null || !config.calendarValid ? '' : config.config.era || '', year, month: match[1], day: Number(match[2]) });
}

const BUILT_IN_METERS = Object.freeze(['trust', 'affection', 'desire', 'tension']);

/**
 * The record `base` (a fresh dossier from createNpcRecord) filled from the person's entry: the profile, the starting
 * numbers, the hidden notes and `castFrom`. `packName` is the pack's name for the badge; `portrait` is the portrait record
 * ({ path, type, hash, … } or, when the file could not be written, { dataUrl, … }) or null. Returns a new record; null without an entry.
 */
export function applyCastEntry(base, person, { packName = '', portrait = null, calendarOwn = false } = {}) {
    const entry = person?.entry;
    if (!isObject(base) || !entry) return null;
    const npc = { ...base };
    npc.aliases = entry.aliases.filter(alias => labelKey(alias) !== labelKey(npc.name)).slice(0, ALIASES_MAX);
    if (entry.about) npc.role = entry.about;
    if (entry.look) npc.overallAppearance = entry.look;
    if (entry.wears) npc.appearance = entry.wears;
    if (entry.voice) npc.speech = entry.voice;
    if (entry.personality) npc.personality = entry.personality;
    if (entry.history) npc.background = entry.history;
    if (entry.behaviour?.length) npc.behaviorProfile = [...entry.behaviour];
    if (entry.mannerisms?.length) npc.mannerisms = [...entry.mannerisms];
    if (entry.withYou) npc.relationshipSummary = entry.withYou;
    // A birthday the writer gave is the person's starting date, kept as 'established' (twins and calendar changes treat it so) but marked
    // as the pack's: a birthday the story states later, 'establish' or 'correct', replaces it. Without one, Delta's date stands.
    const birthDate = castBirthday(entry.birthday, calendarOwn);
    if (birthDate) Object.assign(npc, { birthDate, birthDateSource: 'established', birthDateReason: PACK_BIRTHDAY_REASON, birthDatePrecision: birthDate.year === null ? 'month-day' : 'full', birthDateYearSource: birthDate.year === null ? '' : 'established' });
    if (entry.start.place) npc.homeBase = entry.start.place;
    if (entry.start.goal) npc.goal = entry.start.goal;
    if (person.met?.where) npc.location = person.met.where;
    if (Object.keys(entry.fields).length) npc.customFields = { ...entry.fields };
    const relationship = { ...(isObject(base.relationship) ? base.relationship : {}) };
    for (const meter of BUILT_IN_METERS) if (Number.isInteger(entry.meters.values[meter])) relationship[meter] = Math.max(-100, Math.min(100, entry.meters.values[meter]));
    npc.relationship = relationship;
    // The People field also fills the dossier's own species, gender and ages, only where the fresh dossier holds nothing yet.
    const people = parsePeople(entry.fields[Object.keys(entry.fields).find(name => name.toLowerCase() === 'people')]);
    for (const field of ['species', 'gender', 'age', 'apparentAge']) if (people[field] && !String(npc[field] ?? '').trim()) npc[field] = people[field];
    if (entry.meters.preset) npc.meterSetup = { track: entry.meters.preset, limits: {} };
    const secrets = castSecrets(entry.secrets);
    if (secrets.length) npc.secrets = secrets;
    if (portraitHasImage(portrait)) npc.portrait = portrait;
    npc.castFrom = {
        key: person.key, pack: person.pack, id: person.id,
        ...(shortPackName(packName) ? { packName: shortPackName(packName) } : {}),
        ...(entry.packVersion ? { packVersion: entry.packVersion } : {}),
        met: { on: person.met?.on ?? '', where: person.met?.where ?? '' },
        goal: entry.start.goal, routine: entry.start.routine,
        // The pack's own words, kept exactly while the stored field still is them (core-mechanics normalizeNpcRecord).
        first: Object.fromEntries([['overallAppearance', entry.look], ['appearance', entry.wears], ['speech', entry.voice], ['personality', entry.personality], ['background', entry.history], ['behaviorProfile', entry.behaviour], ['mannerisms', entry.mannerisms]].filter(([, words]) => (Array.isArray(words) ? words.length : words)).map(([field, words]) => [field, Array.isArray(words) ? [...words] : words])),
        ...(entry.stages.length ? { stages: entry.stages } : {}),
    };
    return npc;
}
