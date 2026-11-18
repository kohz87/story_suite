// The job: turning one format 3 pack (a parsed pack.json) into a format 4 world pack and its companion game pack (pack format 4 §2, §3). Pure: no files.
// The notes for the author (climates, the regional weather lines, the names re-keying, what was dropped) come back as data; notes.js writes them.

const GAME_ONLY_CAPABILITIES = ['inventory', 'data-modules-v1'];
const GAME_CAPABILITIES = ['scene', 'inventory', 'data-modules-v1'];
const WORLD_KINDS = ['lore', 'placeKinds', 'routeKinds', 'places', 'routes', 'regions', 'realms', 'markets', 'cast', 'powers', 'scores', 'conditions', 'worldEvents', 'templates', 'foes', 'items'];
const fold = text => String(text ?? '').trim().toLowerCase();
const has = value => value !== undefined && value !== null;

/** The places, by id, name or alias (folded) → the place. */
function placeFinder(places) {
    const index = new Map();
    for (const place of places ?? []) for (const name of [place.id, place.name, ...(place.aliases ?? [])]) if (name && !index.has(fold(name))) index.set(fold(name), place);
    return name => index.get(fold(name)) ?? null;
}

/** A region named by id, name or alias; else the regions whose name contains the fragment (format 3's "contains" match). → [region ids]. */
function regionIdsFor(fragment, regions, extra = {}) {
    const want = fold(fragment);
    if (extra[fragment]) return [extra[fragment]];
    const exact = regions.find(region => [region.id, region.name, ...(region.aliases ?? [])].some(name => fold(name) === want));
    if (exact) return [exact.id];
    return regions.filter(region => fold(region.name).includes(want) || fold(region.id).includes(want)).map(region => region.id);
}

function bumpMajor(version) {
    const major = Number(String(version ?? '').split('.')[0]);
    return Number.isInteger(major) && major >= 0 ? `${Math.max(major + 1, 4)}.0.0` : '4.0.0';
}

function worldStart(source, calendar, findPlace, notes) {
    const start = {};
    if (source.start?.world) start.world = source.start.world;
    const date = calendar?.start;
    if (date) {
        const months = calendar.months ?? [];
        const month = typeof date.month === 'number' ? date.month : months.findIndex(entry => fold(entry.name) === fold(date.month)) + 1;
        start.date = { ...(calendar.era ? { era: calendar.era } : {}), year: date.year, month, day: date.day, hour: date.hour ?? 0, minute: date.minute ?? 0 };
    }
    const scenePlace = source.start?.scene?.place;
    if (scenePlace) {
        const place = findPlace(typeof scenePlace === 'string' ? scenePlace : scenePlace.name);
        if (place?.id) start.place = place.id;
        else notes.dropped.push(`start.scene.place "${scenePlace.name ?? scenePlace}" names no place of the pack, so the world has no start place`);
    }
    if (source.start?.scene?.present) notes.dropped.push('start.scene.present (the cast\'s own start.place places people)');
    return Object.keys(start).length ? start : null;
}

function gameCalendar(calendar, seasons, keepEra) {
    if (!calendar) return null;
    const out = { months: calendar.months };
    if (keepEra && calendar.era) out.era = calendar.era;
    for (const key of ['leapYears', 'week']) if (has(calendar[key])) out[key] = calendar[key];
    if (seasons?.length) out.seasons = seasons;
    if (calendar.holidays?.length) out.holidays = calendar.holidays;
    return out;
}

function gameWeather(weather, regions, climateOf, options, notes) {
    const tables = [];
    for (const table of weather?.tables ?? []) {
        if (!table.region) { tables.push({ climate: 'temperate', ...(table.season ? { season: table.season } : {}), weather: table.weather }); continue; }
        const ids = regionIdsFor(table.region, regions, options.weatherRegions);
        notes.regionalWeather.push({ fragment: table.region, regions: ids, climates: [...new Set(ids.map(climateOf))], season: table.season ?? '', weather: table.weather });
    }
    return tables.length ? { style: 'climate', tables } : weather ? { style: 'climate' } : null;
}

function gameNames(names, regions, notes) {
    if (!names) return null;
    const out = {};
    for (const [key, culture] of Object.entries(names)) {
        if (key === 'banned') { out.banned = culture; continue; }
        const mapped = [];
        for (const fragment of culture.regions ?? []) {
            const ids = regionIdsFor(fragment, regions);
            notes.names.push({ culture: key, fragment, regions: ids });
            for (const id of ids) if (!mapped.includes(id)) mapped.push(id);
        }
        out[key] = { ...culture, regions: mapped };
    }
    return out;
}

/** A copy of `value` with every text `pack.<from>/…` written `pack.<to>/…` (a data module names itself by its pack's id). */
function renamespace(value, from, to, notes) {
    if (typeof value === 'string') {
        if (!value.startsWith(`pack.${from}/`)) return value;
        notes.renamed.push(value);
        return `pack.${to}/${value.slice(from.length + 6)}`;
    }
    if (Array.isArray(value)) return value.map(entry => renamespace(entry, from, to, notes));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, renamespace(entry, from, to, notes)]));
    return value;
}

function gameStart(inventory) {
    if (!inventory) return null;
    const out = {};
    if (has(inventory.money)) out.money = inventory.money;
    if (inventory.items?.length) out.items = inventory.items.map(item => ({ name: item.name, ...(has(item.qty) ? { qty: item.qty } : {}), ...(item.note ? { note: item.note } : {}) }));
    return Object.keys(out).length ? out : null;
}

/**
 * `source`: a parsed format 3 pack. `options`: `{ world: { version? }, game: { id?, version?, name?, description? }, climates: { <region id>: [climate | null, why] },
 * weatherRegions: { <fragment>: <region id> } }`. → `{ world, game, notes }`: the two packs (plain JSON values, keys in the order they are written) and the notes.
 */
export function convert3to4(source, options = {}) {
    const content = source.content ?? {};
    const notes = { climates: [], regionalWeather: [], names: [], dropped: [], renamed: [] };
    const climates = options.climates ?? {};
    const regions = (content.regions ?? []).map(region => {
        const [climate, why] = climates[region.id] ?? [null, 'not in the proposals'];
        notes.climates.push({ id: region.id, name: region.name, climate, why });
        return climate ? { ...region, climate } : { ...region };
    });
    const climateOf = id => regions.find(region => region.id === id)?.climate ?? 'temperate';
    const gameId = options.game?.id ?? `${source.id}-game`;
    const gameVersion = options.game?.version ?? '1.0.0';
    const capabilities = source.requires?.capabilities ?? [];
    const requires = list => ({ suite: source.requires?.suite ?? '^0.1', ...(list.length ? { capabilities: list } : {}) });

    const worldContent = {};
    for (const kind of Object.keys(content)) {
        if (kind === 'regions') worldContent.regions = regions;
        else if (kind === 'cast' && content.cast.some(person => !person.kind)) notes.dropped.push('content.cast in the format 3 shape (no `kind`): a world cast is needed');
        else if (WORLD_KINDS.includes(kind)) worldContent[kind] = content[kind];
        else if (!['you', 'rpg', 'dataModules', 'meterPresets', 'names'].includes(kind)) notes.dropped.push(`content.${kind}`);
    }
    const start = worldStart(source, source.calendar, placeFinder(content.places), notes);
    if (start) worldContent.start = start;
    for (const field of ['ripples', 'layouts', 'screens', 'theme']) if (has(source[field])) notes.dropped.push(field);

    const world = {
        id: source.id, format: 4, kind: 'world', version: options.world?.version ?? bumpMajor(source.version), name: source.name,
        ...(source.author ? { author: source.author } : {}),
        ...(source.description ? { description: source.description.replace(/ \(world-pack spec v[\d.]+\)/, '') } : {}),
        requires: requires(capabilities.filter(name => !GAME_ONLY_CAPABILITIES.includes(name))),
        recommends: { game: { id: gameId, version: `^${gameVersion.split('.').slice(0, 2).join('.')}` } },
        content: worldContent,
    };

    const gameContent = {};
    const sections = {
        calendar: gameCalendar(source.calendar, source.weather?.seasons, !start?.date),
        currency: source.currency ?? null,
        economy: source.economy ?? null,
        weather: gameWeather(source.weather, regions, climateOf, options, notes),
        names: gameNames(content.names, regions, notes),
        you: content.you ?? null,
        rpg: content.rpg ? { formula: 'v1', ...content.rpg } : null,
        dataModules: content.dataModules ?? null,
        meterPresets: content.meterPresets ?? null,
        start: gameStart(source.start?.inventory),
    };
    for (const [key, value] of Object.entries(sections)) if (value) gameContent[key] = renamespace(value, source.id, gameId, notes);
    const game = {
        id: gameId, format: 4, kind: 'game', version: gameVersion, name: options.game?.name ?? `${source.name} rules`,
        ...(source.author ? { author: source.author } : {}),
        description: options.game?.description ?? `The calendar, money and rules that go with ${source.name}`,
        requires: requires(capabilities.filter(name => GAME_CAPABILITIES.includes(name))),
        content: gameContent,
    };
    return { world, game, notes };
}
