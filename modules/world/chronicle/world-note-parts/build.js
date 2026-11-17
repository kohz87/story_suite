// The world note's lines (pure; spec §2 means and told prices, §4 news, seam audit E23 budget and order). In this order, each line
// cut to what is left of about 160 tokens: the scene's place status (a placeStatus condition on it or on the city it sits in), the
// conditions that hold here (the place, the routes from it, then its region and realm: chronicle.conditions `at`), each with what it
// means and its told effects (prices by category, "all goods" first; route speed), the news that has reached here (two newest; one
// still rumour here says so), and today's happening here (world.cueToday). The header with the place status and the conditions is
// one pinned item (`{ text, keep: true }`: kept whatever the budget while the reply's kept room lasts, 120 tokens shared; else an
// ordinary line, still first); the news and today's line follow as ordinary lines, so a tight tail cuts them before the conditions.

import { nowFrom } from '../queries.js';
import { scenePlaceOf } from '../pick.js';
import { hostGeo } from '../conditions/known-refs.js';
import { WORLD_NOTE_BUDGET, worldEventsOn } from './feature.js';
import { slotValue } from '../../../rpg/slot.js';
import { pendingCues } from '../../daily/cues.js';

export const WORLD_NOTE_HEADER = '[World now]';
const MAX_CHARS = WORLD_NOTE_BUDGET * 4;
const MAX_CONDITIONS = 3;
const MAX_NEWS = 2;
const MAX_PART = 110;
const low = text => String(text ?? '').trim().toLowerCase();

function ask(view, name, args) {
    if (typeof view?.query !== 'function') return null;
    try {
        return view.query(name, args) ?? null;
    } catch {
        return null;
    }
}

const clip = (text, room) => {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/, '');
    return flat.length <= room ? flat : `${flat.slice(0, Math.max(0, room - 1)).replace(/\s+\S*$/, '')}…`;
};
const times = value => (typeof value === 'number' ? `×${value}` : String(value ?? '').trim());

/** A condition's told effects (spec §2, ruling 19): "all goods ×1.3, grain ×2" (a named category replaces "all" for itself), a route's speed. */
export function effectsText(effects) {
    const prices = effects?.prices && typeof effects.prices === 'object' ? Object.entries(effects.prices) : [];
    const sorted = [...prices.filter(([name]) => low(name) === 'all'), ...prices.filter(([name]) => low(name) !== 'all')];
    const parts = sorted.map(([name, value]) => `${low(name) === 'all' ? 'all goods' : name} ${times(value)}`);
    if (typeof effects?.routes === 'string' && effects.routes.trim()) parts.push(`routes ${effects.routes.trim()}`);
    return parts.join(', ');
}

// The conditions that hold at the scene, narrowest first: its place (and city), the routes from it, its region, its realm.
function hereConditions(view, scene) {
    const declared = new Map((ask(view, 'chronicle.conditionNames', {}) ?? []).map(entry => [entry.name, entry]));
    const known = ask(view, 'atlas.place', { name: scene });
    const place = typeof known?.name === 'string' && known.name.trim() ? known.name.trim() : scene;
    const region = known?.region;
    const at = ask(view, 'chronicle.conditions', { at: place, ...(region ? { region } : {}) }) ?? [];
    const geo = hostGeo((name, args) => ask(view, name, args));
    const routes = [...new Set([...geo.routes.values()].filter(route => low(route.from) === low(place) || low(route.to) === low(place)).map(route => route.name))].sort();
    const onRoutes = routes.flatMap(route => ask(view, 'chronicle.conditions', { at: route }) ?? []).map(entry => ({ ...entry, level: 0.5 }));
    const seen = new Set();
    return [...at, ...onRoutes].sort((a, b) => a.level - b.level).filter(entry => !seen.has(entry.key) && seen.add(entry.key))
        .map(entry => ({ ...entry, declared: declared.get(entry.name) ?? {} }));
}

function conditionItem(entry) {
    const means = entry.declared.means ? `: ${clip(entry.declared.means, 70)}` : '';
    const told = effectsText(entry.declared.effects);
    return `${entry.name} at ${entry.ref}${means}${told ? ` (${told})` : ''}`;
}

// A news item still rumour at this place carries the tag `rumour` (the pulse's own rumour events carry a `rumour` text); a fact has none.
const isRumour = entry => entry.tag === 'rumour' || (entry.tag === undefined && typeof entry.rumour === 'string');

function heardLines(view, place, now) {
    const heard = ask(view, 'world.heardHere', { place, now });
    // When it was heard here: a fact when its news came (its end's, once heard); a rumour when it was written (its courier is still to come).
    const at = entry => (isRumour(entry) ? entry.updated ?? entry.since : entry.news === 'ended' ? entry.endsAt : entry.arrivesAt) ?? entry.updated ?? 0;
    return (Array.isArray(heard) ? heard : [])
        .filter(entry => entry && typeof entry.name === 'string')
        .sort((a, b) => at(b) - at(a) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, MAX_NEWS)
        .map(entry => `${entry.name}${isRumour(entry) ? ' (rumour)' : ''}${entry.summary ? ` — ${clip(entry.summary, MAX_PART - entry.name.length - (isRumour(entry) ? 9 : 0))}` : ''}`);
}

/** `worldNote(view)` → the note's lines (`[]` while the feature is off or there is nothing to say): the pinned head, then plain lines, within about 160 tokens. */
export function worldNote(view) {
    if (!worldEventsOn(view) || !view?.state?.domains?.chronicle) return [];
    const query = typeof view.query === 'function' ? (name, args) => view.query(name, args) : null;
    const place = scenePlaceOf(query, view.state);
    const now = nowFrom(query, view.state);
    const conditions = place ? hereConditions(view, place) : [];
    const status = conditions.filter(entry => entry.declared.placeStatus === true && entry.scope === 'place');
    const others = conditions.filter(entry => !status.includes(entry)).slice(0, MAX_CONDITIONS);
    const heard = place ? heardLines(view, place, now) : [];
    const cue = ask(view, 'world.cueToday', { now, ...(place ? { place } : {}) });
    const cueText = clip(typeof cue === 'string' ? cue : cue?.text, 140);
    // A must-happen death (ruling 34, daily/cues.js) leads the pinned head, in the spec's words: "<name> dies here: <summary>".
    const dying = pendingCues(slotValue(view.state.domains.chronicle.daily)).map(item => `${clip(item.text, 140)}.`);
    const here = [
        ...dying,
        status.length ? `Status here: ${status.map(entry => `${entry.ref} is ${entry.name}${entry.declared.means ? ` (${clip(entry.declared.means, 60)})` : ''}`).join('; ')}.` : '',
        others.length ? `Conditions here: ${others.map(conditionItem).join('; ')}.` : '',
    ].filter(Boolean);
    const told = [heard.length ? `News that has reached here: ${heard.join('; ')}.` : '', cueText ? `Today: ${cueText}.` : ''].filter(Boolean);
    const out = [WORLD_NOTE_HEADER];
    let used = WORLD_NOTE_HEADER.length;
    let head = 0;
    for (const [index, line] of [...here, ...told].entries()) {
        const room = MAX_CHARS - used - 1;
        const cut = line.length <= room ? line : room > 24 ? `${clip(line, room - 2)}.` : '';
        if (!cut) continue;
        out.push(cut);
        used += 1 + cut.length;
        if (index < here.length) head += 1;
    }
    if (out.length < 2) return [];
    // The head (header, status, conditions; or the header and the first line when there are none) is pinned as one item.
    const size = 1 + Math.max(1, head);
    return [{ text: out.slice(0, size).join('\n'), keep: true }, ...out.slice(size)];
}

/** The note's text, one line each (for tests and previews). */
export const noteText = lines => lines.map(line => (typeof line === 'string' ? line : line.text)).join('\n');
