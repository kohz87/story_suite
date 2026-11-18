// The job: normalizing the fields of a pack object, running each content kind's own check and collecting the normalized pack.

import { METER_LIMITS, PACK_FORMAT, PACK_ID, SEMVER } from '../limits.js';
import { oneLine } from '../../core/text.js';
import { validateDataModules } from '../../modules/data-modules/check.js';
import { STRINGS } from '../../core/strings.js';
import { isObject, records } from '../validate/core.js';
import { checkCurrency, checkEconomy, checkEvent, linkEvents, checkSkill } from '../validate/events-economy.js';
import { checkPlace, placeRefs, checkRoute, routeSlug, checkMarkets, checkNames, checkCondition } from '../validate/world.js';
import { checkItem, checkFoe, checkMeterPreset, checkRpg, checkYou } from '../validate/items.js';
import { checkWorldCast, checkWorldPack, WORLD_KINDS } from '../validate/world-pack.js';
import { checkGameSections } from '../validate/game-parts/run.js';
import { checkRequires } from './requires.js';
import { checkTopFields4, checkKindFields, checkContentKeys } from './envelope.js';

export function normalize(raw, { add, warn, suiteVersion, capabilities, limits, dataModuleDefinitions, readableConditions }) {
    // Only format 4 is read (two kinds, envelope.js): any other format number is refused before anything else is looked at.
    if (!checkFormat(raw.format, add)) return null;
    checkTopFields4(raw, add);

    const id = raw.id;
    if (typeof id !== 'string' || !PACK_ID.test(id)) add('BAD_ID', 'id', 'id must be 1 to 40 lowercase letters, digits or dashes, starting with a letter or digit (like "fantasy-basics").');
    else if (id === 'chat') add('BAD_ID', 'id', STRINGS.blocks.reservedPack);
    const packId = typeof id === 'string' && PACK_ID.test(id) ? id : 'invalid';
    if (typeof raw.version !== 'string' || !SEMVER.test(raw.version)) add('BAD_VERSION', 'version', 'version must look like 1.0.0.');
    for (const field of ['name', 'author']) {
        if (raw[field] !== undefined && (typeof raw[field] !== 'string' || [...raw[field]].length > limits.name)) add('BAD_FIELD', field, `${field} must be text of at most ${limits.name} characters.`);
    }
    if (raw.description !== undefined && typeof raw.description !== 'string') add('BAD_FIELD', 'description', 'description must be text.');

    const requires = checkRequires(raw.requires, { add, suiteVersion, capabilities });
    const { kind, recommends } = checkKindFields(raw, add);
    // Currency, economy, calendar, weather and start are `content` keys of a game pack.
    const money = kind === 'game' && isObject(raw.content) ? raw.content : {};
    const addMoney = (code, path, message) => add(code, `content.${path}`, message);
    const currency = money.currency === undefined ? null : checkCurrency(money.currency, addMoney);
    const economy = money.economy === undefined ? null : checkEconomy(money.economy, addMoney);
    let calendar = null;
    let weather = null;

    const content = {};
    if (raw.content !== undefined && !isObject(raw.content)) add('BAD_CONTENT', 'content', 'content must be an object of lists: { "items": [ … ], "events": [ … ] }.');
    const rawContent = isObject(raw.content) ? raw.content : {};
    const given = checkContentKeys(kind, rawContent, add);
    let gameSections = null;
    // A game pack's own sections (game-parts/run.js): calendar, weather, start, pacing and the RPG options.
    if (kind === 'game') {
        gameSections = checkGameSections({ given, packId, add, warn });
        calendar = gameSections.calendar;
        weather = gameSections.weather;
    }
    // Items first: the start state refers to them.
    const items = records(given.items, 'items', { add, packId, check: (record, path, label) => checkItem(record, path, label, add) });
    content.items = items;
    content.events = records(given.events, 'events', { add, packId, check: (record, path) => checkEvent(record, path, add, readableConditions), slugField: 'id' });
    linkEvents(content.events, packId, add);
    // Kinds added later are kept only when given, so older packs normalize as they always did.
    if (given.skills !== undefined) content.skills = records(given.skills, 'skills', { add, packId, check: (record, path, label) => checkSkill(record, path, label, add) });
    // A world pack names a place by `id` (spec §1); the store keeps it as the place's slug.
    if (given.places !== undefined) content.places = records(Array.isArray(given.places) ? given.places.map(place => (isObject(place) && place.id !== undefined && place.slug === undefined ? { ...place, slug: place.id } : place)) : given.places, 'places', { add, packId, check: (record, path, label) => checkPlace(record, path, label, add, true) });
    if (given.routes !== undefined) {
        const place = placeRefs(content.places ?? []);
        content.routes = records(given.routes, 'routes', { add, packId, check: (record, path) => checkRoute(record, path, add, place), named: false, autoSlug: routeSlug });
    }
    // The declared world conditions: kept only when given.
    if (given.conditions !== undefined) content.conditions = records(given.conditions, 'conditions', { add, packId, check: (record, path, label) => checkCondition(record, path, label, add) });
    if (given.markets !== undefined) content.markets = checkMarkets(given.markets, packId, add);
    // Do not create this key for old packs: their normalized bytes and hashes are history.
    if (given.dataModules !== undefined) {
        const checked = validateDataModules(given.dataModules, { packId, capabilities: requires.capabilities, definitions: dataModuleDefinitions });
        if (checked.ok) content.dataModules = checked.definitions;
        else for (const error of checked.errors) add(error.code, error.path, error.message);
    }
    if (given.foes !== undefined) content.foes = records(given.foes, 'foes', { add, packId, check: (record, path, label) => checkFoe(record, path, label, add) });
    if (given.meterPresets !== undefined) {
        if (Array.isArray(given.meterPresets) && given.meterPresets.length > METER_LIMITS.presets) add('BAD_CONTENT', 'content.meterPresets', `content.meterPresets holds at most ${METER_LIMITS.presets} presets.`);
        else content.meterPresets = records(given.meterPresets, 'meterPresets', { add, packId, check: (record, path) => checkMeterPreset(record, path, add), slugField: 'id', named: false });
    }
    if (given.rpg !== undefined) content.rpg = gameSections ? gameSections.rpg : checkRpg(given.rpg, packId, add, warn);
    // The cast: only a world pack holds one, and it is always the world cast (spec §8): one bad person is refused alone, the rest load.
    const worldCast = kind === 'world' && given.cast !== undefined;
    if (given.cast !== undefined) content.cast = checkWorldCast(given.cast, packId, add, warn, true);
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

    // The world pack (spec v0.13): realms, kind maps, powers, scores, events, templates, lore; and the cross checks over the places, conditions and cast.
    const world = kind === 'world' || WORLD_KINDS.some(name => given[name] !== undefined);
    let startWorld;
    let startNow = {};
    if (world || worldCast || given.conditions !== undefined) {
        const { startWorld: checked, startDate, startPlace, ...kept } = checkWorldPack({ given, content, packId, weather, calendar, rawStart: isObject(given.start) ? given.start : null, ripples: null, add, warn, world, worldCast, v4: true });
        Object.assign(content, kept);
        startWorld = checked;
        startNow = { ...(startDate ? { date: startDate } : {}), ...(startPlace ? { place: startPlace } : {}) };
    }

    // `start` is under content; a world's part (world, date, place) is checked above, a game's money and items by the game sections.
    const start = gameSections ? gameSections.start : (startWorld || startNow.date || startNow.place ? { ...(startWorld ? { world: startWorld } : {}), ...startNow } : null);

    return {
        id: packId,
        format: raw.format,
        ...(kind ? { kind } : {}),
        version: raw.version,
        name: [...oneLine(raw.name || packId)].slice(0, limits.name).join(''),
        author: [...oneLine(raw.author ?? '')].slice(0, limits.name).join(''),
        description: String(raw.description ?? ''),
        requires,
        currency,
        economy,
        calendar,
        // Kept only when given, so older packs normalize as they always did.
        ...(recommends ? { recommends } : {}),
        ...(gameSections?.pacing ? { pacing: gameSections.pacing } : {}),
        ...(weather ? { weather } : {}),
        content,
        start,
        layouts: [],
        screens: [],
        theme: {},
    };
}

// `format`: only the newest format is read. A missing format or an older whole number is FORMAT_OLD, a newer one FORMAT_NEWER, anything else a plain error.
// Returns true when it is the format read here.
function checkFormat(value, add) {
    if (value === PACK_FORMAT) return true;
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) add('BAD_FIELD', 'format', `format must be a whole number such as ${PACK_FORMAT}.`);
    else if (value > PACK_FORMAT) add('FORMAT_NEWER', 'format', `This pack is written in format ${value}; this suite reads format ${PACK_FORMAT}. Update the suite.`);
    else add('FORMAT_OLD', 'format', `This pack ${value === undefined ? 'has no format number' : `is written in format ${value}`}; this suite reads format ${PACK_FORMAT} only. Write "format": ${PACK_FORMAT} and "kind": "world" or "game", or convert it with the Studio or scripts/packs/convert-3to4.mjs.`);
    return false;
}
