// Story Director v2, tracker part (initiative): finds who could take the initiative now and how urgent their threads are.

import { lineKey } from '../../../changes.js';
import { isDue } from '../../../relevance.js';
import { waitsForPay } from '../../../tracker.js';
import { orderedThreads, toTracker } from '../convert.js';
import { calendarOf, packCalendarOf, settingsFrom } from '../time.js';
import { dropThreads, quietThreads } from '../quiet.js';
import { ask, cutPoints, dueWithin, flat, knownToUser, namesPerson, sceneOf } from '../scene.js';
import { isInt } from './shared-guards.js';
import { isPersona } from './persona.js';

// NPCs NSD knows that are asked for where they are, at most (nearby).
const NEARBY_ASKED = 24;
const KINDS = new Set(['agenda', 'event', 'hook', 'quest', 'clock', 'beat']);

// Trust in -100…100 as a weight in hundredths: ×0.25 at -100 (never 0: anyone can speak up), ×1 at 0, ×2 at +100.
function trustWeight(trust) {
    if (!Number.isFinite(trust)) return 100;
    const t = Math.max(-100, Math.min(100, Math.round(trust)));
    return t >= 0 ? 100 + t : Math.max(25, 100 + Math.round(t * 0.75));
}

function trustOf(query, person, nsd) {
    if (!nsd) return null;
    const meters = ask(query, 'npc.meters', { name: person.name }, null);
    const trust = Number(meters?.meters?.trust ?? person.dossier?.relationship?.trust);
    return Number.isFinite(trust) ? trust : null;
}

// The NPCs NSD knows that are not present but whose dossier says they are at the scene's place or region.
function nearbyPeople(query, scene) {
    if (!scene.nsd || !(scene.place || scene.region)) return [];
    const known = ask(query, 'npc.known', {}, []);
    const here = new Set(scene.people.map(person => person.key));
    const at = [scene.place, scene.region].map(name => lineKey(name)).filter(key => key.length >= 3);
    const out = [];
    for (const entry of (Array.isArray(known) ? known : []).slice(0, NEARBY_ASKED)) {
        const name = cutPoints(entry, 80);
        if (!lineKey(name) || here.has(lineKey(name))) continue;
        const dossier = ask(query, 'npc.dossier', { name }, null);
        const where = lineKey(flat(dossier?.location));
        if (!where || !at.some(key => where.includes(key) || key.includes(where))) continue;
        const own = cutPoints(dossier?.name, 80) || name;
        const aliases = Array.isArray(dossier?.aliases) ? dossier.aliases : [];
        out.push({ name: own, key: lineKey(own), names: [...new Set([own, name, ...aliases.map(alias => cutPoints(alias, 80))].filter(word => word.length >= 3))], dossier, nearby: true });
    }
    return out;
}

/**
 * Who could take the initiative now: `[{ key, name, weight, urgency, topic, dueNow, nearby }]`, by key.
 * `topic`: the key of their most urgent thread when {{user}} knows of it, else ''.
 */
export function initiativeCandidates({ director: given, state = null, query = null, settings = {}, scene = null, persona = null } = {}) {
    if (!given) return [];
    // A fired beat and a dead person's own threads give nobody the first step (quiet.js).
    const director = dropThreads(given, quietThreads(given, { state, query }));
    const seen = scene ?? sceneOf(query, state);
    const own = settingsFrom(settings);
    let calendar = null;
    try { calendar = calendarOf(own, packCalendarOf(query)); } catch { calendar = null; }
    const now = isInt(director.time?.minutes) ? director.time.minutes : null;
    const threads = orderedThreads(director);
    const records = toTracker(director).records;
    const open = records.map((record, index) => ({ record, thread: threads[index], index }))
        .filter(({ record }) => record.status === 'active' && KINDS.has(record.kind));
    if (!open.length) return [];
    // The player's persona is in the scene's people but never takes the initiative (matched by the same line keys as the people).
    const people = [...seen.people, ...nearbyPeople(query, seen)].filter(person => !isPersona(person, persona));
    const out = [];
    for (const person of people) {
        let best = null;
        for (const entry of open) {
            if (!namesPerson(entry.record, person, { strict: true, group: true })) continue;
            const dueNow = isDue(entry.record, { calendar, now });
            const urgency = dueNow ? 4
                : (entry.thread?.ready || waitsForPay(entry.record) || dueWithin(entry.record, { calendar, now, days: own.dueSoonDays })) ? 3 : 2;
            if (!best || urgency > best.urgency) best = { ...entry, urgency, dueNow };
        }
        if (!best) continue;
        const weight = best.urgency * trustWeight(trustOf(query, person, seen.nsd));
        out.push({
            key: person.key, name: person.name, weight, urgency: best.urgency, dueNow: best.dueNow, nearby: Boolean(person.nearby),
            topic: knownToUser(best.record) ? cutPoints(best.record.key, 80) : '',
        });
    }
    return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
