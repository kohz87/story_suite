// The game view header's own props: the `ss.hero` block and the module toggle pills.

import { TEXT_MAX, count, safeQuery, textOf } from './shared-reads.js';
import { portraitCandidates, portraitOf } from './avatars.js';
import { pictureOf } from './hero-context.js';
import { conditionIcon, conditionLabel, conditionLeft } from './conditions.js';
import { clockProps } from './clock.js';

/**
 * The props of `ss.hero` for the game view's header, or null when there is no state to show (no chat).
 * `query(name, args)` reads the head state; `context` is readHeroContext()'s answer; `formatTime(minutes)` is the host's fmt.time.
 * `weatherOn` is the weather feature (off: the corner draws no weather and no pencil for it). `lead` is the RPG's own record of the
 * lead ({ name?, bars }, lean-rpg/view/hero-data.js) for a story whose lead is not answered by `party.pc`: its bars are the header's.
 */
export function gameHeroProps({ state = null, query = null, context = {}, formatTime = null, weatherOn = true, rpgLead = null } = {}) {
    if (!state) return null;
    const pc = safeQuery(query, 'party.pc', {});
    const lead = pc && typeof pc === 'object' ? pc : null;
    const terms = safeQuery(query, 'party.terms', {});
    const levelWord = textOf(terms?.levelName) || 'Lv';
    const level = lead ? count(lead.level) : null;
    const name = textOf(lead?.name) || textOf(context.personaName) || textOf(context.cardName);
    const npc = name ? pictureOf(safeQuery(query, 'npc.portrait', { name })) : '';
    const place = safeQuery(query, 'scene.place', {});
    const weather = safeQuery(query, 'scene.weather', {});
    // `scene.you` answers null while the feature is off (or with no Story Block): no rows then, not empty ones.
    const you = safeQuery(query, 'scene.you', {});
    const time = safeQuery(query, 'director.time', {});
    const clock = clockProps(time, time && typeof time === 'object' && 'parts' in time ? safeQuery(query, 'director.calendar', {}) : null);
    // The trip Story Director keeps (`atlas.trip`, 2.5): its one-line `row`; null with no trip, with the feature off or with an older Story Director.
    const trip = safeQuery(query, 'atlas.trip', {});
    const travel = textOf(trip?.row).slice(0, 200);
    const minutes = count(time?.minutes);
    const bars = [];
    for (const [kind, label] of [['hp', 'HP'], ['mp', 'MP'], ['sp', 'SP']]) {
        const pool = lead?.[kind];
        const max = count(pool?.max);
        if (max == null || max <= 0) continue;
        bars.push({ kind, label, value: count(pool.cur) ?? 0, max, text: `${count(pool.cur) ?? 0} / ${max}` });
    }
    // No party module answers (the RPG keeps its character in a block): its three stage bars and its experience are the header's.
    if (!bars.length && Array.isArray(rpgLead?.bars)) bars.push(...rpgLead.bars);
    // A condition is named by its kind (or its name); its icon and its time left come from the kind and the entry's own fields.
    const kindOf = entry => (typeof entry?.kind === 'string' && entry.kind ? entry.kind : typeof entry?.name === 'string' ? entry.name : '');
    const statuses = (Array.isArray(lead?.conditions) ? lead.conditions : [])
        .filter(entry => entry && typeof entry === 'object' && kindOf(entry))
        .slice(0, 12)
        .map(entry => ({ id: kindOf(entry), label: conditionLabel(kindOf(entry)), icon: conditionIcon(kindOf(entry)), tone: 'bad', kind: kindOf(entry), ...conditionLeft(entry, minutes) }));
    const when = minutes != null && typeof formatTime === 'function' ? textOf(formatTime(minutes)) : '';
    // The corner's pencils (ss.hero `where`): the people here, the places a pack names, and whether the weather feature is on.
    const present = safeQuery(query, 'scene.present', {});
    const places = safeQuery(query, 'packs.content', { kind: 'places' });
    return {
        name: name.slice(0, 60),
        portrait: portraitOf({ personaFile: context.personaFile, cardFile: context.cardFile, npcPicture: npc }),
        portraits: portraitCandidates({ personaFile: context.personaFile, cardFile: context.cardFile, npcPicture: npc }),
        className: textOf(lead?.className ?? lead?.class).slice(0, 40),
        level: level != null ? `${levelWord} ${level}`.slice(0, TEXT_MAX) : '',
        title: textOf(lead?.role).slice(0, 40),
        bars,
        place: textOf(place?.name).slice(0, 40),
        time: when.slice(0, 40),
        weather: textOf(weather?.text).slice(0, 40),
        where: {
            present: (Array.isArray(present) ? present : []).map(person => textOf(typeof person === 'string' ? person : person?.name).slice(0, 80)).filter(Boolean).slice(0, 12),
            places: Array.isArray(places) ? places : [],
            weatherOn: weatherOn !== false,
            place: textOf(place?.name).slice(0, 80),
            weatherText: textOf(weather?.text).slice(0, 60),
        },
        statuses,
        ...(you && typeof you === 'object' ? { you: { ...(textOf(you.rankLabel) ? { rank: textOf(you.rank).slice(0, 120), rankLabel: textOf(you.rankLabel).slice(0, 30) } : {}), wearing: textOf(you.wearing).slice(0, 120), condition: textOf(you.condition).slice(0, 120), command: 'scene.you' } } : {}),
        ...(travel ? { travel } : {}),
        ...(clock ? { clock } : {}),
    };
}

/**
 * The game view header's module toggles (registry.headerControls(), one per module): each asks its own `query` (with `args`) for the state,
 * a boolean or `{ on }`; any other answer (null while its feature is off, an absent module, a query that fails) leaves the pill out.
 * → [{ key, label, icon, command, payload, on }]. Label and icon are cut by code points; the icon is a short text (an emoji).
 */
export function headerControlItems({ controls = [], query = null } = {}) {
    const items = [];
    for (const control of Array.isArray(controls) ? controls : []) {
        const answer = safeQuery(query, control?.query, control?.args ?? {});
        const on = answer && typeof answer === 'object' ? answer.on : answer;
        if (typeof on !== 'boolean') continue;
        items.push({ key: String(control.key), label: [...textOf(control.label)].slice(0, 24).join(''), icon: [...textOf(control.icon)].slice(0, 4).join(''), command: control.command, payload: control.payload ?? {}, on });
    }
    return items;
}
