// The job: running every world-pack check over the content a pack gave and returning what is kept (spec v0.13).
// Everything here is structural: it does not depend on the world-events switch. Pure.

import { ROUTE_CLASSES, SLUG, WORLD_LIMITS } from '../../limits.js';
import { foldKey } from '../../../core/text.js';
import { isObject } from '../core.js';
import { buildIndex, routeNameOf } from './index.js';
import { checkKindsUsed, classOfKind, placeKindMap, routeKindMap } from './kinds.js';
import { checkMapNames, checkRealms } from './realms.js';
import { checkPowers, checkScores } from './standings.js';
import { checkWorldEvent } from './world-event.js';
import { checkTemplate } from './template.js';
import { checkLore } from './lore.js';
import { crossCast } from './cast-pass.js';

/** The kinds that make a pack a world pack (the full structural check applies). */
export const WORLD_KINDS = Object.freeze(['lore', 'placeKinds', 'routeKinds', 'realms', 'powers', 'scores', 'worldEvents', 'templates']);

// Two routes between the same two places must each carry a name, and route names are unique (B13).
function checkRouteNames(routes, add) {
    const pairs = new Map();
    const names = new Map();
    routes.forEach((route, index) => {
        const key = [foldKey(route.from), foldKey(route.to)].sort().join('|');
        pairs.set(key, [...(pairs.get(key) ?? []), index]);
        const name = foldKey(routeNameOf(route).replace(/[–—]/g, '-'));
        if (names.has(name)) add('DUPLICATE', `content.routes[${index}]`, `Route "${routeNameOf(route)}" has the same name as route ${names.get(name)}; route names are unique (give each a "name").`);
        else names.set(name, index);
    });
    for (const members of pairs.values()) {
        if (members.length < 2) continue;
        for (const index of members) if (!routes[index].name) add('BAD_RECORD', `content.routes[${index}].name`, `Route "${routes[index].from}" to "${routes[index].to}": two routes join the same two places, so each needs a "name".`);
    }
}

function checkHours(routes, routeKinds, warn) {
    routes.forEach((route, index) => {
        if (route.hours !== null && classOfKind(route.kind, routeKinds, ROUTE_CLASSES) !== 'sea') warn('HOURS_ON_NON_SEA', `content.routes[${index}].hours`, `Route "${routeNameOf(route)}": hours is the lane time of a sea route, but this route's kind is not a sea class; the courier reads it as given.`);
    });
}

/** What every event, template, lore entry and cast entry is checked with. */
function contextFactory(index, add, collect) {
    return (path, label, { placeholders = false } = {}) => {
        let ok = true;
        return { index, collect, placeholders, ok: () => ok, say: (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); } };
    };
}

/**
 * `given`: the raw content; `content`: the kinds already normalized (places, routes, conditions, items, markets, cast, events).
 * `{ world: true }` runs the full set; otherwise only the checks a conditions-only pack needs. Returns the kept parts for `content`.
 */
export function checkWorldPack({ given, content, packId, weather, ripples, add, warn, world, worldCast }) {
    const kept = {};
    const placeKinds = given.placeKinds === undefined ? null : placeKindMap(given.placeKinds, add);
    const routeKinds = given.routeKinds === undefined ? null : routeKindMap(given.routeKinds, add);
    if (placeKinds) kept.placeKinds = placeKinds;
    if (routeKinds) kept.routeKinds = routeKinds;
    const places = content.places ?? [];
    const routes = content.routes ?? [];
    const realms = given.realms === undefined ? [] : checkRealms(given.realms, add);
    if (given.realms !== undefined) kept.realms = realms;
    if (world) {
        checkKindsUsed(places, routes, { placeKinds, routeKinds }, add);
        checkMapNames({ places, routes, realms }, add);
        checkRouteNames(routes, add);
        checkHours(routes, routeKinds, warn);
    }
    const base = { places, routes, realms, conditions: content.conditions ?? [], items: content.items ?? [], markets: content.markets ?? [], weather, placeKinds,
        worldEvents: Array.isArray(given.worldEvents) ? given.worldEvents.filter(record => isObject(record) && typeof record.id === 'string') : [], legacyEvents: content.events ?? [] };
    const resolvePlace = text => buildIndex(base).placeByRef(text);
    const ripplesNames = new Set((ripples?.powers ?? []).map(power => foldKey(power.name ?? '')));
    const powers = given.powers === undefined ? [] : checkPowers(given.powers, resolvePlace, ripplesNames, add, warn);
    const scores = given.scores === undefined ? [] : checkScores(given.scores, add);
    if (given.powers !== undefined) kept.powers = powers;
    if (given.scores !== undefined) kept.scores = scores;

    const collect = { facts: new Set(), factRefs: new Set(), timed: new Set(), cleared: new Set(), warnings: [] };
    const rawIds = new Set((Array.isArray(given.cast) ? given.cast : []).map(record => record?.id).filter(id => typeof id === 'string'));
    const crossed = worldCast ? crossCast(content.cast, rawIds, { ...base, powers, scores }, warn, person => `content.cast[${given.cast.findIndex(record => record?.id === person.id)}]`, collect) : { cast: content.cast ?? [], refused: new Set() };
    const cast = crossed.cast;
    if (worldCast) kept.cast = cast;
    const index = buildIndex({ ...base, powers, scores, cast, refused: crossed.refused });
    const makeCtx = contextFactory(index, add, collect);

    const seenIds = new Set();
    if (given.worldEvents !== undefined) {
        const events = [];
        if (!Array.isArray(given.worldEvents) || given.worldEvents.length > WORLD_LIMITS.events) add('BAD_CONTENT', 'content.worldEvents', `content.worldEvents must be a list of at most ${WORLD_LIMITS.events} events.`);
        else given.worldEvents.forEach((record, n) => {
            const path = `content.worldEvents[${n}]`;
            if (!isObject(record)) return add('BAD_RECORD', path, `${path} must be an object.`);
            const ctx = makeCtx(path, `Event ${typeof record.id === 'string' ? `"${record.id}"` : path}`, { placeholders: record.kind === 'recurring' });
            if (typeof record.id === 'string' && SLUG.test(record.id)) {
                if (seenIds.has(record.id)) ctx.say('id', `two worldEvents share the id "${record.id}".`, 'DUPLICATE');
                else if (index.legacyIds.has(record.id)) ctx.say('id', `"${record.id}" is also the id of a legacy event in content.events; event ids are unique across both lists.`, 'DUPLICATE');
                seenIds.add(record.id);
            }
            const copy = checkWorldEvent(record, ctx);
            if (ctx.ok()) events.push(copy);
        });
        kept.worldEvents = events;
    }
    if (given.templates !== undefined) {
        const templates = [];
        const names = new Set();
        if (!Array.isArray(given.templates) || given.templates.length > WORLD_LIMITS.templates) add('BAD_CONTENT', 'content.templates', `content.templates must be a list of at most ${WORLD_LIMITS.templates} templates.`);
        else given.templates.forEach((record, n) => {
            const path = `content.templates[${n}]`;
            if (!isObject(record)) return add('BAD_RECORD', path, `${path} must be an object.`);
            const ctx = makeCtx(path, `Template ${typeof record.template === 'string' ? `"${record.template}"` : path}`, { placeholders: true });
            if (names.has(record.template)) ctx.say('template', `two templates are named "${record.template}".`, 'DUPLICATE');
            names.add(record.template);
            const copy = checkTemplate(record, ctx);
            if (ctx.ok()) templates.push(copy);
        });
        kept.templates = templates;
    }
    if (given.lore !== undefined) kept.lore = checkLore(given.lore, makeCtx, add, warn);

    postChecks({ content, index, collect, add, warn, world });
    return kept;
}

// Whole-pack checks: price categories, a fact nothing writes, a placeStatus with no clearing path.
function postChecks({ content, index, collect, add, warn }) {
    (content.conditions ?? []).forEach((condition, n) => {
        for (const category of Object.keys(condition.effects?.prices ?? {})) {
            if (category !== 'all' && !index.categories.has(category)) add('UNKNOWN_REF', `content.conditions[${n}].effects.prices.${category}`, `Condition "${condition.name}": "${category}" is no declared goods category; prices name a category (an item tag of this pack or a category its markets declare), never an individual good.`);
        }
        if (condition.placeStatus && condition.fades === 'until cleared' && !collect.cleared.has(condition.name) && !collect.timed.has(condition.name)) {
            warn('NO_CLEARING_PATH', `content.conditions[${n}]`, `Condition "${condition.name}" is a place status that lasts until cleared, and nothing in this pack clears it or gives it a duration; add a template or event that clears it, or a maximum duration.`);
        }
    });
    for (const id of collect.factRefs) if (!collect.facts.has(id)) warn('UNWRITTEN_FACT', 'content.worldEvents', `The fact "${id}" is named by an anchor or gate but no event, outcome or template in this pack writes it; it can only be set by hand or by a later pack.`);
    for (const [field, message] of collect.warnings) warn('WORLD_WARNING', 'content.worldEvents', `${field}: ${message}`);
}
