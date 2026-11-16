// Rolls the entry for one reply: the table kind, its effect applied, its line.

import { lineKey } from '../../changes.js';
import { dateOf } from '../../../atlas/relevance.js';
import { castOf, partyPlace, pinnedKeys, presentKeys, roadsOf, travelOf } from '../../../cast/cast/entries.js';
import { chanceCandidates } from '../../../cast/cast/world.js';
import { cueOf } from '../../../cast/cast/note.js';
import { hiddenNames } from '../../world/known.js';
import { calendarFrom } from '../../../cast/keypeople/time.js';
import { isPersona } from '../../../time/tracker/initiative.js';
import { orderedThreads } from '../../../time/tracker/convert.js';
import { ask, cutPoints, namesPerson } from '../../../time/tracker/scene.js';
import { d20Of, fillSlots, flavourFor, pickIndex, placeGroupOf, plainSlot, resolveKind, tableFor, briefFor, intensityOf, ACTOR_NEEDS, QUIET_FALLBACK, QUIET_SPREAD } from '../tables.js';
import { RUMOUR_ROOM } from './limits.js';
import { TAIL_CHARS, BRIEF_CHARS, cutWord } from './lines.js';
import { isInt, isRecord } from './shared-guards.js';
import { NAME_MAX } from './shared-names.js';
import { effectFor } from './dispatch.js';

const EFFECTS = new Set(['GOSSIP_SURGE', 'OVERHEARD_DETAIL', 'CHANCE_MEETING', 'ENTER_CHECK', 'TASK_SHIFT']);
const WEATHER_WORDS = [['rain', /rain|drizzle|shower|storm/i], ['snow', /snow|blizzard|sleet/i], ['fog', /fog|mist|haze/i], ['wind', /wind|gale|gust/i], ['heat', /heat|hot|scorch|swelter/i]];

/** The weather word an ENV_SHIFT line knows, from the scene's weather text; null for none. */
export const weatherFrom = text => WEATHER_WORDS.find(([, pattern]) => pattern.test(String(text ?? '')))?.[0] ?? null;

// Open agendas the scene does not reach (not tied to its place, not naming anyone present), by id.
function offscreenAgendas(director, scene) {
    const place = String(scene.place ?? '').toLowerCase();
    const tied = thread => place.length >= 3 && ['place', 'now', 'leg', 'where'].some(name => String(thread.fields?.[name] ?? '').toLowerCase().includes(place));
    const record = thread => ({ key: thread.key, fields: thread.fields ?? {} });
    return orderedThreads(director).filter(thread => thread.kind === 'agenda' && thread.status === 'active' && !tied(thread)
        && !scene.people.some(person => namesPerson(record(thread), person, { strict: true })));
}

// The roll's entry for this reply: the kind from the table (stepping past what cannot happen), its effect applied, its line.
export function rollEntry({ ctx, director, state, query, scene, draw, at, clock, mode, reach = 0, persona = '', v2 = false, invents = true, recent = [] }) {
    const here = ask(query, 'atlas.here', {}, null);
    const place = cutPoints(here?.name || scene.place, NAME_MAX);
    const group = placeGroupOf(here?.placeKind ?? here?.kind ?? '');
    const weather = weatherFrom(ask(query, 'scene.weather', {}, null)?.text);
    const calendar = calendarFrom(query);
    const agendas = offscreenAgendas(director, scene);
    const people = state.domains.cast?.people;
    // Reach (every new reply): only people who can be at the party's place now cross its path by chance; 2: road trips only, the party's place or town, from the last known place too;
    // 3 (new steps): the place and its town by the atlas's ids and parent links, a road or wilderness only itself (cast/world.js `atPlace`). Reach 2 replays as it was (`old`).
    // {{user}} is never the subject of an event (the narrator would be ordered to write the player's actions): not a mood, not a chance meeting. Only a step that carries `persona` (every new reply) knows it; an older reply re-read keeps its rolls.
    const others = scene.people.filter(person => !isPersona(person, persona));
    const party = reach === 2 ? { ...partyPlace(query, state), old: true } : partyPlace(query, state);
    const near = reach ? chanceCandidates(state.domains.cast, castOf(query), { party, now: clock, travel: reach >= 2 ? roadsOf(query) : travelOf(query), strict: reach >= 2, present: presentKeys(query, state), pinned: pinnedKeys(query) }).filter(item => !isPersona({ key: item.key, name: item.person?.name }, persona)) : null;
    const unmet = Object.entries(isRecord(people) ? people : {}).filter(([key, person]) => isRecord(person) && person.alive !== false && !person.met && !isPersona({ key, name: person.name }, persona)).map(([, person]) => person);
    const open = ask(query, 'chronicle.events', { open: true }, []);
    // Old pulse rumours are closed first (their time is up, or the event they were about ended). Only the pulse's own are candidates for the facts, never its rumours.
    if (open.some(event => event?.rumour)) { try { ctx.call('chronicle.rumor', { at, expire: true }); } catch { /* the roll goes on */ } }
    const room = open.length < RUMOUR_ROOM;
    // A fact already told as a rumour (open or over) is not told again: the roll steps down rather than write nothing.
    const told = new Set(ask(query, 'chronicle.events', {}, []).filter(event => event?.rumour).map(event => lineKey(event.rumour)));
    const known = room ? open.filter(event => !event?.rumour && !told.has(lineKey(event?.name))) : [];
    const behind = hiddenNames(state).behind;
    const converge = thread => {
        const fields = thread.fields ?? {};
        if (fields.leg || fields.arrive) return true;
        const there = ask(query, 'atlas.place', { name: plainSlot(fields.where || fields.place, NAME_MAX) }, null)?.region;
        return Boolean(lineKey(here?.region) && lineKey(there) === lineKey(here?.region));
    };
    const away = Object.keys(state.domains.keypeople?.away ?? {}).length;
    const names = new Set(scene.people.map(person => person.key));
    for (const name of [...ask(query, 'npc.known', {}, []), ...Object.values(isRecord(people) ? people : {}).map(person => person?.name)]) if (lineKey(name)) names.add(lineKey(name));
    const lively = mode === 'lively';
    const counts = { present: others.length, offscreen: lively ? agendas.length + away + unmet.length : 1, known: lively ? known.length : 1, cast: lively ? (near ? near.length : unmet.length) : 1 };
    const table = tableFor({ named: names.size, offscreen: agendas.length + away + unmet.length });
    const d20 = d20Of(draw.d20);
    // Version 2: how strongly it shows; never the same kind twice running, nor two intrusive ones; the narrator may invent the event from what the note holds.
    const lastKind = v2 ? recent.at(-1)?.kind : '';
    const intensity = v2 ? intensityOf(draw.d20, recent.at(-1)?.intensity) : '';
    const material = v2 && invents && (others.length > 0 || open.length > 0 || orderedThreads(director).some(thread => thread.status === 'active'));
    const blocked = new Set(lastKind && lastKind !== 'CALM' ? [lastKind] : []);
    for (let tries = 0; tries < 8; tries += 1) {
        const rolled = resolveKind(table, d20, { group, weather, counts, blocked });
        // Quiet: an effect entry keeps its band but reads as its flavour fallback.
        const quiet = !lively && (v2 ? QUIET_SPREAD : QUIET_FALLBACK)[rolled.kind];
        if (quiet && v2 && quiet === lastKind) { blocked.add(rolled.kind); continue; } else if (quiet) rolled.kind = quiet;
        const base = { d20, table, kind: rolled.kind, ...(intensity ? { intensity } : {}), ...(place ? { place } : {}) };
        if (!EFFECTS.has(rolled.kind)) {
            const who = others.length ? others[pickIndex(others.length, draw.actor)]?.name : '';
            if (material && rolled.kind !== 'CALM') return { ...base, invent: true, text: `${rolled.kind.toLowerCase().replaceAll('_', ' ')} (${intensity}): the narrator invents it`, brief: cutWord(briefFor({ kind: rolled.kind, intensity, group, name: ACTOR_NEEDS[rolled.kind] === 'present' ? who : '', recent }), BRIEF_CHARS) };
            const text = rolled.kind === 'CALM' ? '' : fillSlots(flavourFor(rolled.kind, draw.line, { group, weather, wide: v2 }), { name: who, place });
            return { ...base, ...(who && text.includes(who) ? { who } : {}), text: cutWord(text, TAIL_CHARS) };
        }
        const made = effectFor(rolled.kind, {
            known, behind, at, place, draw, cast: near ? { people: Object.fromEntries(near.map(item => [item.key, item.person])) } : state.domains.cast, persona, here: near ? new Set(near.filter(item => item.here).map(item => item.key)) : null, now: clock, format: minutes => calendar.format(minutes),
            agendas: agendas.filter(rolled.kind === 'ENTER_CHECK' ? converge : () => true).map(thread => ({ id: thread.id, name: thread.key, named: false, arrive: thread.fields?.arrive, text: thread.fields?.on, abs: dateOf(thread, 'on', { calendar, reference: clock })?.abs })),
        });
        if (made && applyEffect(ctx, director, made)) {
            const cue = made.type === 'cast.meet' ? meetingCue(ctx, query, made.receipt.who) : '';
            return { ...base, ...(cue ? { cue } : {}), text: cutWord(made.tail, TAIL_CHARS), effect: { type: made.type, ...made.receipt } };
        }
        blocked.add(rolled.kind);
    }
    return { d20, table, kind: 'CALM', text: '' };
}

// The cast's own cue for the person the pulse just met (read from this step's draft), as the cast part tells a meeting: '' when it cannot be made.
function meetingCue(ctx, query, key) {
    try {
        const person = ctx.read('cast')?.people?.[key];
        return isRecord(person?.met) ? `[Cast] ${cueOf(person, castOf(query).byKey.get(key))}` : '';
    } catch { return ''; }
}

// The effect's step: another part's command (the same receipt), or the agenda's own date on the thread (marked ctx.ifThere).
function applyEffect(ctx, director, made) {
    if (made.type === 'chronicle.rumor' || made.type === 'cast.meet') {
        try { ctx.call(made.type, made.payload); return true; } catch { return false; }
    }
    const thread = director.threads?.[made.payload.thread];
    if (!thread || thread.status !== 'active') return false;
    if (typeof ctx.ifThere === 'function') ctx.ifThere('director', `/threads/${thread.id}`);
    // Only the date moves: nobody is placed anywhere (no `where`), so no one is teleported.
    thread.fields = { ...thread.fields, [made.payload.field]: made.payload.to };
    if (isInt(ctx.rev)) thread.rev = ctx.rev;
    return true;
}
