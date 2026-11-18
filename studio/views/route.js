// Where each part of a pack is drawn: one editor file per content key (per kind) and one file per page that is not one key. Every
// later Studio job replaces the body of one of these files and leaves this table, app.js and the other hub files alone.
//
// The contract (scratch/design/studio-jobs.md §1.3):
//   studio/edit/<x>.js  export function editSection(section, ctx) → Node[]    section: { key, where: 'content'|'top', value, count }
//   studio/views/<x>.js export function renderPage(ctx) → Node[]             (no nodes: the page is not mounted)
//   ctx: { doc, kind, legacy, other, refs, problems, focus, commit(patches), setPortrait(name, bytes), openDoc(opened), go(partId, rec, path?),
//          portrait(name) } — app.js builds it; until the editing jobs land, commit, setPortrait and openDoc refuse.

import * as overview from '../edit/overview.js';
import * as lore from '../edit/lore.js';
import * as cast from '../edit/cast.js';
import * as places from '../edit/places.js';
import * as routes from '../edit/routes.js';
import * as regions from '../edit/regions.js';
import * as kinds from '../edit/kinds.js';
import * as conditions from '../edit/conditions.js';
import * as events from '../edit/events.js';
import * as templates from '../edit/templates.js';
import * as start from '../edit/start.js';
import * as powers from '../edit/powers.js';
import * as items from '../edit/items.js';
import * as gameCalendar from '../edit/game-calendar.js';
import * as gameMoney from '../edit/game-money.js';
import * as gameWeather from '../edit/game-weather.js';
import * as gameNames from '../edit/game-names.js';
import * as gameRules from '../edit/game-rules.js';
import * as gameTrackers from '../edit/game-trackers.js';
import * as gameStart from '../edit/game-start.js';
import * as mapPage from './map.js';
import * as graphPage from './graph.js';
import * as timelinePage from './timeline.js';
import * as pairingPage from './pairing.js';
import * as convertPage from './convert.js';
import * as startPage from './start.js';
import { renderSection } from './records.js';

const EDIT = { overview, lore, cast, places, routes, regions, kinds, conditions, events, templates, start, powers, items,
    'game-calendar': gameCalendar, 'game-money': gameMoney, 'game-weather': gameWeather, 'game-names': gameNames, 'game-rules': gameRules, 'game-trackers': gameTrackers, 'game-start': gameStart };
const VIEW = { map: mapPage, graph: graphPage, timeline: timelinePage, pairing: pairingPage, convert: convertPage, start: startPage };

/**
 * Content key → editor (`studio/edit/<name>.js`), per kind; `top` is the Overview fields. A format 3 pack is drawn with the world
 * table (its dated `events` too); a key with no editor (a format 3 pack's rules, calendar and the like) is drawn read-only.
 */
export const EDITORS = Object.freeze({
    top: Object.freeze({ id: 'overview', format: 'overview', kind: 'overview', version: 'overview', name: 'overview', author: 'overview', description: 'overview', requires: 'overview', recommends: 'overview' }),
    world: Object.freeze({ lore: 'lore', cast: 'cast', places: 'places', routes: 'routes', regions: 'regions', realms: 'regions', placeKinds: 'kinds', routeKinds: 'kinds', markets: 'kinds',
        conditions: 'conditions', start: 'start', worldEvents: 'events', events: 'events', templates: 'templates', powers: 'powers', scores: 'powers', items: 'items', foes: 'items' }),
    game: Object.freeze({ calendar: 'game-calendar', currency: 'game-money', economy: 'game-money', weather: 'game-weather', names: 'game-names', you: 'game-rules', rpg: 'game-rules', pacing: 'game-rules',
        meterPresets: 'game-trackers', dataModules: 'game-trackers', start: 'game-start' }),
});

/**
 * Page id → `studio/views/<id>.js` and where it mounts (`when` says whether the mount applies; the page must also draw something):
 * `segment` a "List · <label>" switch at the top of that part, `part` a part of its own (parts.js), `card` at the top of Overview.
 */
export const PAGES = Object.freeze({
    map: Object.freeze({ file: 'views/map.js', mount: 'segment', part: 'map', label: 'Map', when: ({ pack }) => pack?.kind === 'world' }),
    graph: Object.freeze({ file: 'views/graph.js', mount: 'segment', part: 'events', label: 'Graph', when: ({ pack }) => pack?.kind === 'world' }),
    timeline: Object.freeze({ file: 'views/timeline.js', mount: 'part', part: 'timeline', when: ({ world }) => Boolean(world && !world.legacy) }),
    pairing: Object.freeze({ file: 'views/pairing.js', mount: 'part', part: 'pairing', when: ({ world }) => Boolean(world) }),
    convert: Object.freeze({ file: 'views/convert.js', mount: 'card', part: 'overview', when: ({ pack }) => Boolean(pack?.legacy && pack.doc) }),
    start: Object.freeze({ file: 'views/start.js', mount: 'start', part: null, when: () => true }),
});

/** One section's nodes: its editor's, or the read-only cards when the key has none. `ctx.kind` picks the table. */
export function sectionNodes(section, ctx) {
    const name = section.where === 'top' ? EDITORS.top[section.key] : EDITORS[ctx.kind]?.[section.key];
    const nodes = name ? EDIT[name].editSection(section, ctx) : [renderSection(section, ctx)];
    return nodes.flat().filter(Boolean);
}

/** One page's nodes (`[]`: the page draws nothing, so its mount stays hidden). */
export function pageNodes(id, ctx) {
    return (VIEW[id]?.renderPage(ctx) ?? []).flat().filter(Boolean);
}
