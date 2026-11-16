// The job: normalizing the fields of a pack object, running each content kind's own check and collecting the normalized pack.

import { CONTENT_KINDS, DEFAULT_CRAFTS, METER_LIMITS, PACK_FIELDS, PACK_ID, SEMVER, TERMS_LIMITS } from '../limits.js';
import { oneLine } from '../../core/text.js';
import { validateDataModules } from '../../packages/story-block/src/v2/data-modules/check.js';
import { STRINGS } from '../../core/strings.js';
import { checkCast } from '../cast.js';
import { isObject, records, openRecord } from '../validate/core.js';
import {
    checkCurrency, checkEconomy, checkWeather, checkRipples, checkEvent, checkChoice, linkEvents, checkSkill, choiceRefs,
    checkPreset, checkStart,
} from '../validate/events-economy.js';
import { checkCalendar, checkPlace, placeRefs, checkRoute, routeSlug, checkTerms, termsSlug, checkRanks, checkMarkets, checkNames } from '../validate/world.js';
import { checkItem, itemRefs, checkShop, checkCrafts, checkRecipe, checkMeterPreset, checkRpg, checkYou } from '../validate/items.js';
import { checkScreens, checkTheme } from '../validate/theme.js';
import { checkRequires } from './requires.js';

export function normalize(raw, { add, warn, hostVersion, capabilities, limits, dataModuleDefinitions, readableConditions }) {
    for (const key of Object.keys(raw)) if (!PACK_FIELDS.includes(key)) add('UNKNOWN_FIELD', key, `"${key}" is not a pack field (expected ${PACK_FIELDS.join(', ')}).`);

    const id = raw.id;
    if (typeof id !== 'string' || !PACK_ID.test(id)) add('BAD_ID', 'id', 'id must be 1 to 40 lowercase letters, digits or dashes, starting with a letter or digit (like "fantasy-basics").');
    else if (id === 'chat') add('BAD_ID', 'id', STRINGS.blocks.reservedPack);
    const packId = typeof id === 'string' && PACK_ID.test(id) ? id : 'invalid';
    if (typeof raw.version !== 'string' || !SEMVER.test(raw.version)) add('BAD_VERSION', 'version', 'version must look like 1.0.0.');
    for (const field of ['name', 'author']) {
        if (raw[field] !== undefined && (typeof raw[field] !== 'string' || [...raw[field]].length > limits.name)) add('BAD_FIELD', field, `${field} must be text of at most ${limits.name} characters.`);
    }
    if (raw.description !== undefined && typeof raw.description !== 'string') add('BAD_FIELD', 'description', 'description must be text.');

    const requires = checkRequires(raw.requires, { add, hostVersion, capabilities });
    const currency = raw.currency === undefined ? null : checkCurrency(raw.currency, add);
    const calendar = raw.calendar === undefined ? null : checkCalendar(raw.calendar, add);
    const economy = raw.economy === undefined ? null : checkEconomy(raw.economy, add);
    const weather = raw.weather === undefined ? null : checkWeather(raw.weather, add);
    const ripples = raw.ripples === undefined ? null : checkRipples(raw.ripples, warn);

    const content = {};
    if (raw.content !== undefined && !isObject(raw.content)) add('BAD_CONTENT', 'content', 'content must be an object of lists: { "items": [ … ], "events": [ … ] }.');
    const given = isObject(raw.content) ? raw.content : {};
    for (const kind of Object.keys(given)) if (!CONTENT_KINDS.includes(kind) && kind !== 'you') add('UNKNOWN_KIND', `content.${kind}`, `"${kind}" is not a content kind (expected ${[...CONTENT_KINDS, 'you'].join(', ')}).`);
    // Items first: shops, recipes and the start state refer to them.
    const items = records(given.items, 'items', { add, packId, check: (record, path, label) => checkItem(record, path, label, add) });
    content.items = items;
    const ref = itemRefs(items, packId);
    content.creatures = records(given.creatures, 'creatures', { add, packId, check: openRecord });
    content.shops = records(given.shops, 'shops', { add, packId, check: (record, path) => checkShop(record, path, add, ref) });
    // Crafts before recipes: a recipe's `craft` is a default craft or one this pack declares.
    const crafts = given.crafts === undefined ? null : checkCrafts(given.crafts, packId, add);
    const craftIds = new Set([...DEFAULT_CRAFTS.map(craft => craft.craft), ...(crafts ?? []).map(craft => craft.slug)]);
    content.recipes = records(given.recipes, 'recipes', { add, packId, check: (record, path) => checkRecipe(record, path, add, ref, craftIds) });
    content.events = records(given.events, 'events', { add, packId, check: (record, path) => checkEvent(record, path, add, readableConditions), slugField: 'id' });
    content.quests = records(given.quests, 'quests', { add, packId, check: openRecord });
    content.races = records(given.races, 'races', { add, packId, check: (record, path, label) => checkChoice(record, path, label, add), slugField: 'id', named: true });
    content.talents = records(given.talents, 'talents', { add, packId, check: (record, path, label) => checkChoice(record, path, label, add), slugField: 'id', named: true });
    linkEvents(content.events, packId, add);
    // Kinds added later are kept only when given, so older packs normalize as they always did.
    if (given.skills !== undefined) content.skills = records(given.skills, 'skills', { add, packId, check: (record, path, label) => checkSkill(record, path, label, add) });
    if (given.presets !== undefined) {
        const choose = { race: choiceRefs(content.races), talent: choiceRefs(content.talents), skill: choiceRefs(content.skills ?? []) };
        content.presets = records(given.presets, 'presets', { add, packId, check: (record, path, label) => checkPreset(record, path, label, add, choose), slugField: 'id', named: true });
    }
    if (given.places !== undefined) content.places = records(given.places, 'places', { add, packId, check: (record, path, label) => checkPlace(record, path, label, add) });
    if (given.routes !== undefined) {
        const place = placeRefs(content.places ?? []);
        content.routes = records(given.routes, 'routes', { add, packId, check: (record, path) => checkRoute(record, path, add, place), named: false, autoSlug: routeSlug });
    }
    if (given.terms !== undefined) {
        if (Array.isArray(given.terms) && given.terms.length > TERMS_LIMITS.records) add('BAD_CONTENT', 'content.terms', `content.terms holds at most ${TERMS_LIMITS.records} records.`);
        else content.terms = records(given.terms, 'terms', { add, packId, check: (record, path, label) => checkTerms(record, path, label, add), slugField: 'id', named: false, autoSlug: termsSlug() });
    }
    if (given.ranks !== undefined) content.ranks = checkRanks(given.ranks, packId, add);
    if (given.markets !== undefined) content.markets = checkMarkets(given.markets, packId, add);
    // Do not create this key for old packs: their normalized bytes and hashes are history.
    if (given.dataModules !== undefined) {
        const checked = validateDataModules(given.dataModules, { packId, capabilities: requires.capabilities, definitions: dataModuleDefinitions });
        if (checked.ok) content.dataModules = checked.definitions;
        else for (const error of checked.errors) add(error.code, error.path, error.message);
    }
    if (crafts !== null) content.crafts = crafts;
    if (given.meterPresets !== undefined) {
        if (Array.isArray(given.meterPresets) && given.meterPresets.length > METER_LIMITS.presets) add('BAD_CONTENT', 'content.meterPresets', `content.meterPresets holds at most ${METER_LIMITS.presets} presets.`);
        else content.meterPresets = records(given.meterPresets, 'meterPresets', { add, packId, check: (record, path) => checkMeterPreset(record, path, add), slugField: 'id', named: false });
    }
    if (given.rpg !== undefined) content.rpg = checkRpg(given.rpg, packId, add);
    // The cast (cast.js): kept only when given, so older packs normalize as they always did.
    if (given.cast !== undefined) content.cast = checkCast(given.cast, packId, add, items, calendar);
    // The name lists: one object (not a list), kept only when given and when every part checks.
    if (given.names !== undefined) {
        const names = checkNames(given.names, warn);
        if (names) content.names = names;
    }
    // Not a list: kept only when given (so older packs' bytes and hashes stay), and only when it checks.
    if (given.you !== undefined) {
        const you = checkYou(given.you, add);
        if (you) content.you = you;
    }

    const start = raw.start === undefined ? null : checkStart(raw.start, add, ref);
    let layouts = [];
    if (raw.layouts !== undefined) {
        if (!Array.isArray(raw.layouts) || raw.layouts.some(layout => !isObject(layout))) add('BAD_LAYOUTS', 'layouts', 'layouts must be a list of layout objects.');
        else layouts = raw.layouts.map(layout => ({ ...layout, pack: packId }));
    }
    const screens = raw.screens === undefined ? [] : checkScreens(raw.screens, packId, add);
    const theme = raw.theme === undefined ? {} : checkTheme(raw.theme, add, 'theme');

    return {
        id: packId,
        version: raw.version,
        name: [...oneLine(raw.name || packId)].slice(0, limits.name).join(''),
        author: [...oneLine(raw.author ?? '')].slice(0, limits.name).join(''),
        description: String(raw.description ?? ''),
        requires,
        currency,
        economy,
        calendar,
        // Kept only when given, so older packs normalize as they always did.
        ...(weather ? { weather } : {}),
        ...(ripples ? { ripples } : {}),
        content,
        start,
        layouts,
        screens,
        theme,
    };
}
