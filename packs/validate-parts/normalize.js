// The job: normalizing the fields of a pack object, running each content kind's own check and collecting the normalized pack.

import { CONTENT_KINDS, IGNORED_KINDS, IGNORED_TOP_FIELDS, METER_LIMITS, PACK_FIELDS, PACK_FORMAT, PACK_FORMAT_DEFAULT, PACK_ID, SEMVER } from '../limits.js';
import { oneLine } from '../../core/text.js';
import { validateDataModules } from '../../modules/data-modules/check.js';
import { STRINGS } from '../../core/strings.js';
import { checkCast } from '../cast.js';
import { isObject, records } from '../validate/core.js';
import { checkCurrency, checkEconomy, checkWeather, checkRipples, checkEvent, linkEvents, checkSkill, checkStart } from '../validate/events-economy.js';
import { checkCalendar, checkPlace, placeRefs, checkRoute, routeSlug, checkMarkets, checkNames } from '../validate/world.js';
import { checkItem, itemRefs, checkFoe, checkMeterPreset, checkRpg, checkYou } from '../validate/items.js';
import { checkTheme } from '../validate/theme.js';
import { checkRequires } from './requires.js';

export function normalize(raw, { add, warn, hostVersion, suiteVersion, capabilities, limits, dataModuleDefinitions, readableConditions }) {
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

    const format = checkFormat(raw.format, add);
    const requires = checkRequires(raw.requires, { add, hostVersion, suiteVersion, capabilities });
    const currency = raw.currency === undefined ? null : checkCurrency(raw.currency, add);
    const calendar = raw.calendar === undefined ? null : checkCalendar(raw.calendar, add);
    const economy = raw.economy === undefined ? null : checkEconomy(raw.economy, add);
    const weather = raw.weather === undefined ? null : checkWeather(raw.weather, add);
    const ripples = raw.ripples === undefined ? null : checkRipples(raw.ripples, warn);

    const content = {};
    if (raw.content !== undefined && !isObject(raw.content)) add('BAD_CONTENT', 'content', 'content must be an object of lists: { "items": [ … ], "events": [ … ] }.');
    const given = isObject(raw.content) ? raw.content : {};
    for (const kind of Object.keys(given)) if (!CONTENT_KINDS.includes(kind) && kind !== 'you') add('UNKNOWN_KIND', `content.${kind}`, `"${kind}" is not a content kind (expected ${[...CONTENT_KINDS, 'you'].join(', ')}).`);
    // Kinds nothing reads any more are said once and left out.
    for (const kind of IGNORED_KINDS) if (given[kind] !== undefined) warn('IGNORED_KIND', `content.${kind}`, `content.${kind} is not read any more (pack format ${PACK_FORMAT}); it was left out.`);
    // Items first: the start state refers to them.
    const items = records(given.items, 'items', { add, packId, check: (record, path, label) => checkItem(record, path, label, add) });
    content.items = items;
    const ref = itemRefs(items, packId);
    content.events = records(given.events, 'events', { add, packId, check: (record, path) => checkEvent(record, path, add, readableConditions), slugField: 'id' });
    linkEvents(content.events, packId, add);
    // Kinds added later are kept only when given, so older packs normalize as they always did.
    if (given.skills !== undefined) content.skills = records(given.skills, 'skills', { add, packId, check: (record, path, label) => checkSkill(record, path, label, add) });
    if (given.places !== undefined) content.places = records(given.places, 'places', { add, packId, check: (record, path, label) => checkPlace(record, path, label, add) });
    if (given.routes !== undefined) {
        const place = placeRefs(content.places ?? []);
        content.routes = records(given.routes, 'routes', { add, packId, check: (record, path) => checkRoute(record, path, add, place), named: false, autoSlug: routeSlug });
    }
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
    if (given.rpg !== undefined) content.rpg = checkRpg(given.rpg, packId, add, warn);
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
    for (const field of IGNORED_TOP_FIELDS) if (raw[field] !== undefined) warn('IGNORED_FIELD', field, `${field} is not read any more (pack format ${PACK_FORMAT}); it was left out.`);
    const theme = raw.theme === undefined ? {} : checkTheme(raw.theme, add, 'theme');

    return {
        id: packId,
        // Kept only when the file gives it, so an older pack's normalized bytes and hashes stay what they were; a pack without it is format 2.
        ...(raw.format !== undefined ? { format } : {}),
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
        layouts: [],
        screens: [],
        theme,
    };
}

// `format`: the pack format the file is written in. Left out, it is format 2 (the one before the number existed); a newer one than this suite reads is refused.
function checkFormat(value, add) {
    if (value === undefined) return PACK_FORMAT_DEFAULT;
    if (!Number.isInteger(value) || value < 1) add('BAD_FIELD', 'format', 'format must be a whole number such as 3.');
    else if (value > PACK_FORMAT) add('FORMAT_NEWER', 'format', `This pack is written in format ${value}; this suite reads formats up to ${PACK_FORMAT}. Update the suite.`);
    else return value;
    return PACK_FORMAT_DEFAULT;
}
