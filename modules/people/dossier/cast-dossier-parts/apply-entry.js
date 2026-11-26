// Filling a fresh dossier from a cast person's pack entry (profile, numbers, hidden notes, castFrom).

import { portraitHasImage } from '../../portrait/portrait-file.js';
import { PACK_BIRTHDAY_REASON, normalizeBirthDate } from '../../birthday/birthday.js';
import { getActiveCalendarConfig, normalizeCalendarConfig } from '../../calendar/calendar.js';
import { ALIASES_MAX } from './limits-text.js';
import { castSecrets } from './entry-lists.js';
import { castGatedSecrets } from './entry-gated.js';
import { shortPackName } from './dossier-lookup.js';
import { parsePeople } from './people-field.js';
import { isObject, labelKey } from './shared-text.js';
import { normalizeApparentAge } from '../../core/core-identity.js';

// The writer's birthday, "Month day" or "Month day, year" (Story Block checks it against the pack's calendar), read on the active
// calendar: the date as established, or null when it does not fit that calendar (the dossier then keeps Delta's own date).
function castBirthday(text) {
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
 * ({ path, type, hash, … } or, when the file could not be written, { dataUrl, … }) or null; `placeName(id)` gives a pack place's name (the starting place's
 * fallback). Returns a new record; null without an entry.
 */
export function applyCastEntry(base, person, { packName = '', portrait = null, gated = false, placeName = null } = {}) {
    const entry = person?.entry;
    if (!isObject(base) || !entry) return null;
    const npc = { ...base };
    npc.aliases = entry.aliases.filter(alias => labelKey(alias) !== labelKey(npc.name)).slice(0, ALIASES_MAX);
    for (const [field, value] of [['role', entry.role], ['species', entry.species], ['gender', entry.gender], ['age', entry.age], ['apparentAge', entry.apparentAge], ['homeBase', entry.homeBase], ['status', entry.status]]) if (value) npc[field] = value;
    if (entry.level) npc.level = entry.level;
    if (entry.abilities?.length) npc.abilities = entry.abilities.map(row => ({ ...row }));
    if (entry.keepsakes?.length) npc.keepsakes = entry.keepsakes.map(row => ({ ...row }));
    if (entry.keyRelationships?.length) npc.keyRelationships = [...entry.keyRelationships];
    if (entry.forms?.length) npc.appearanceForms = entry.forms.map(row => ({ ...row }));
    if (entry.look) npc.overallAppearance = entry.look;
    if (entry.wears) npc.appearance = entry.wears;
    if (entry.voice) npc.speech = entry.voice;
    if (entry.personality) npc.personality = entry.personality;
    if (entry.history) npc.background = entry.history;
    if (entry.behaviour?.length) npc.behaviorProfile = [...entry.behaviour];
    if (entry.mannerisms?.length) npc.mannerisms = [...entry.mannerisms];
    if (entry.withYou) { npc.relationshipSummary = entry.withYou; delete npc.relationshipSummarySource; }   // (the pack's words, not a `toward:` sentence)
    // A birthday the writer gave is the person's starting date, kept as 'established' (twins and calendar changes treat it so) but marked
    // as the pack's: a birthday the story states later, 'establish' or 'correct', replaces it. Without one, Delta's date stands.
    const birthDate = castBirthday(entry.birthday);
    if (birthDate) Object.assign(npc, { birthDate, birthDateSource: 'established', birthDateReason: PACK_BIRTHDAY_REASON, birthDatePrecision: birthDate.year === null ? 'month-day' : 'full', birthDateYearSource: birthDate.year === null ? '' : 'established' });
    const goal = entry.goal || entry.start.goal;
    if (goal) npc.goal = goal;
    if (Object.keys(entry.fields ?? {}).length) npc.customFields = { ...entry.fields };
    // Without the place they were met at, the starting place: a format 4 entry gives it as a place id, so only its name (`placeName`, the
    // host's pack places) is shown, never the id; a format 3 entry wrote the place in words.
    let startName = '';
    try { startName = entry.kind && typeof placeName === 'function' ? String(placeName(entry.start.place) ?? '').trim() : ''; } catch { startName = ''; }
    const place = person.met?.where || (entry.kind ? startName : entry.start.place);
    if (place) npc.location = place;
    const relationship = { ...(isObject(base.relationship) ? base.relationship : {}) };
    for (const meter of BUILT_IN_METERS) if (Number.isInteger(entry.meters.values[meter])) relationship[meter] = Math.max(-100, Math.min(100, entry.meters.values[meter]));
    npc.relationship = relationship;
    // Format 3: the People field also fills species, gender and ages, only where the fresh dossier holds nothing yet (removed with format 3, job X1).
    const people = parsePeople(entry.fields?.[Object.keys(entry.fields ?? {}).find(name => name.toLowerCase() === 'people')]);
    for (const field of ['species', 'gender', 'age', 'apparentAge']) if (people[field] && !String(npc[field] ?? '').trim()) npc[field] = people[field];
    if (entry.meters.preset) npc.meterSetup = { track: entry.meters.preset, limits: {} };
    const secrets = [...castSecrets(entry.secrets), ...(gated ? entry.gated ?? castGatedSecrets(entry.secrets) : [])];
    if (secrets.length) npc.secrets = secrets;
    if (portraitHasImage(portrait)) npc.portrait = portrait;
    npc.castFrom = {
        key: person.key, pack: person.pack, id: person.id,
        ...(shortPackName(packName) ? { packName: shortPackName(packName) } : {}),
        ...(entry.packVersion ? { packVersion: entry.packVersion } : {}),
        met: { on: person.met?.on ?? '', where: person.met?.where ?? '' },
        goal, routine: entry.start.routine,
        // The pack's own words, kept exactly while the stored field still is them (core-mechanics normalizeNpcRecord).
        // `status` (S2PA B11): what they were doing before the meeting; while the stored status still is it, it is not shown or told as what they do now.
        first: Object.fromEntries([['overallAppearance', entry.look], ['appearance', entry.wears], ['speech', entry.voice], ['personality', entry.personality], ['background', entry.history], ['behaviorProfile', entry.behaviour], ['mannerisms', entry.mannerisms], ['status', entry.status],
            // An apparent age in words the normalizer cannot read as a number ("looks older") stays as the pack wrote it.
            ['apparentAge', entry.apparentAge && !normalizeApparentAge(entry.apparentAge, npc.name) ? entry.apparentAge : '']].filter(([, words]) => (Array.isArray(words) ? words.length : words)).map(([field, words]) => [field, Array.isArray(words) ? [...words] : words])),
        ...(entry.stages.length ? { stages: entry.stages } : {}),
        // Ties and key relationships to cast people not met yet, by cast id only (never shown or injected): cast-links.js names them at read once that person is met.
        ...(entry.pendingLinks ? { links: structuredClone(entry.pendingLinks) } : {}),
    };
    return npc;
}
