// Story Director and pack lookups for the Story Suite v2 adapter. A pure part of src/adapter/queries.js
// (same owner, moved without change); queries.js re-exports every public name it exported before.
import { storyMinuteText } from '../legacy/calendar.js';
import { CAST_QUERY } from '../meters/npc-meters.js';
import { normalizeCast } from '../dossier/cast-dossier.js';
import { safeImageUrl } from './queries-dossier.js';

// Story Block's query for a pack portrait's image URL (read only): packs.portrait({ pack, file }) → a safe URL or null.
const PORTRAIT_QUERY = 'packs.portrait';
// Story Block 2.18.0's query for a pack cast member's signature gear line (read only): packs.castGear({ name }) → { name, line: "Gear: A, B", items } or null.
const CAST_GEAR_QUERY = 'packs.castGear';

export function createDirectorQueriesPart(session, deps, { hostFeature }) {
    const { WORLD_FEATURE } = deps;

    // Whether Story Director's World screen shows the present cast (its feature on); a host without the
    // Features API: whether Story Director is registered.
    function worldShown() {
        if (!session.hosted) return false;
        const on = hostFeature(WORLD_FEATURE);
        if (on !== undefined) return on === true;
        try { return (session.sdkRef?.modules?.() ?? []).some(module => module?.id === 'story-director'); } catch { return false; }
    }

    // The living cast (Story Director's `director.cast`, read only): the cleaned answer with its dates written on Story Director's
    // calendar, or null (not hosted, no Story Director, or one without the query). Null means "no cast anywhere".
    function castAnswer() {
        if (!session.hosted || typeof session.sdkRef?.query !== 'function') return null;
        try {
            const answer = session.sdkRef.query(CAST_QUERY, {});
            return Array.isArray(answer) ? answer : null;
        } catch {
            return null;
        }
    }
    function castPeople() {
        const answer = castAnswer();
        if (!answer) return null;
        const calendar = directorCalendar();
        return normalizeCast(answer, minutes => storyMinuteText(minutes, calendar));
    }
    // The slice's record of the cast dossiers made (npc.castMade), {} when there is none or no host.
    function castMade() {
        if (!session.hosted || typeof session.sdkRef?.query !== 'function') return {};
        try {
            const made = session.sdkRef.query('npc.castMade', {});
            return made && typeof made === 'object' && !Array.isArray(made) ? made : {};
        } catch {
            return {};
        }
    }
    // Packs' names by id (`packs.list`), for the badge; {} when the host cannot say.
    function packNames() {
        if (!session.hosted || typeof session.sdkRef?.query !== 'function') return {};
        try {
            const list = session.sdkRef.query('packs.list', {});
            return Object.fromEntries((Array.isArray(list) ? list : []).filter(pack => pack && typeof pack.id === 'string')
                .map(pack => [pack.id, String(pack.name ?? pack.title ?? '').trim()]).filter(([, name]) => name));
        } catch {
            return {};
        }
    }
    // A pack place's name (`packs.content` kind places) for its id, slug, name or alias (any case); '' when no enabled pack has it or the host cannot say.
    function placeName(ref) {
        const placeKey = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
        const wanted = placeKey(ref);
        if (!wanted || !session.hosted || typeof session.sdkRef?.query !== 'function') return '';
        try {
            const list = session.sdkRef.query('packs.content', { kind: 'places' });
            for (const place of Array.isArray(list) ? list : []) {
                if (!place || typeof place.name !== 'string' || !place.name.trim()) continue;
                const slug = typeof place.id === 'string' ? place.id.slice(place.id.lastIndexOf('/') + 1) : place.slug;
                if ([place.name, slug, ...(Array.isArray(place.aliases) ? place.aliases : [])].some(word => placeKey(word) === wanted)) return place.name.trim();
            }
        } catch { /* no name */ }
        return '';
    }
    // A pack portrait's image URL (`packs.portrait`) as a safe URL (safeImageUrl), or null.
    function packPortraitUrl(pack, file) {
        if (!session.hosted || typeof session.sdkRef?.query !== 'function' || !pack || !file) return null;
        try { return safeImageUrl(session.sdkRef.query(PORTRAIT_QUERY, { pack, file })); } catch { return null; }
    }
    // A pack cast member's one "Gear: A, B" line (`packs.castGear`), or '' (no host, an older Story Block without the query, or it answers null).
    function castGearLine(name) {
        if (!session.hosted || typeof session.sdkRef?.query !== 'function' || !name) return '';
        try {
            const line = session.sdkRef.query(CAST_GEAR_QUERY, { name })?.line;
            return typeof line === 'string' ? line.replace(/\s+/g, ' ').trim() : '';
        } catch { return ''; }
    }
    // Story Director's calendar (`director.calendar`: { era, months, leapYears }), or null when it has none to give; 
    function directorCalendar() {
        try {
            const config = session.hosted && typeof session.sdkRef?.query === 'function' ? session.sdkRef.query('director.calendar', {}) : null;
            return config && typeof config === 'object' && Array.isArray(config.months) ? config : null;
        } catch {
            return null;
        }
    }
    // Story Block's `party.levels` ([{ id, name, level, left }], left members too), or null: not hosted, no host query, or the RPG off.
    function partyLevelsAnswer() {
        if (!session.hosted || typeof session.sdkRef?.query !== 'function') return null;
        try {
            const answer = session.sdkRef.query('party.levels', {});
            return Array.isArray(answer) ? answer : null;
        } catch {
            return null;
        }
    }
    return { worldShown, partyLevelsAnswer, castAnswer, castPeople, castMade, packNames, placeName, packPortraitUrl, castGearLine, directorCalendar };
}
