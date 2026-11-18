// A test host for the news arrival: the real chronicle, atlas and world queries over one state, a pack's places and routes, and a switch.

import { part as atlas } from '../../../../modules/atlas/atlas/index.js';
import { part as world } from '../../../../modules/world/world/index.js';
import { part as chronicle } from '../../../../modules/world/chronicle/index.js';
import { clockAt, lines, makeState, sceneAt } from '../chronicle/helpers/fake-ctx.js';

export const DAY = 1440;
export const PACK = {
    places: [
        { name: 'Bluewatch', region: 'Frontier', kind: 'town', x: 0, y: 0 },
        { name: 'Hollin', region: 'Frontier', kind: 'town', x: 1, y: 0 },
        { name: 'Wolfmere', region: 'Frontier', kind: 'fort', x: 2, y: 0 },
        { name: 'Glassdock', region: 'Coast', kind: 'port', x: 3, y: 0 },
        { name: 'Far Keep', region: 'Other', kind: 'fort', x: 9, y: 9 },
    ],
    routes: [
        { from: 'Bluewatch', to: 'Hollin', kind: 'road', km: 120 },
        { from: 'Hollin', to: 'Wolfmere', kind: 'road', km: 60 },
        { from: 'Bluewatch', to: 'Glassdock', kind: 'river', km: 440, hours: 96 },
    ],
};
const parts = { ...atlas.queries, ...world.queries, ...chronicle.queries };

/** The tools a query gets: `on` the switch, `kmPerDay` the courier's setting; `state` is the head. */
export function hostFor(state, { on = true, kmPerDay, pack = PACK } = {}) {
    const tools = {
        query: (name, args = {}) => {
            if (name === 'packs.content') return structuredClone(pack[args.kind] ?? []);
            if (name === 'director.time') return { minutes: state.domains.director?.time?.minutes ?? null, text: '' };
            if (name === 'scene.place') return { ...state.domains.scene.place };
            const fn = parts[name];
            if (!fn) throw new Error(`no query ${name}`);
            return structuredClone(fn(state, structuredClone(args), tools));
        },
        settings: () => (kmPerDay ? { courierKmPerDay: kmPerDay } : {}),
        feature: id => (id === 'story-director.world-events' ? on : false),
    };
    return tools;
}

/** A view for the tail (the hook's `view`): `{ state, query, settings, feature, chat }`. */
export const viewFor = (state, options) => ({ state, ...hostFor(state, options), chat: { length: 10, lastUser: '' } });

/** A chronicle with the given `[name, place]` events begun on day 1, the clock at `day`, the scene at `at`. */
export function worldAt({ events, day, at = 'Wolfmere' }) {
    let state = makeState({ minutes: DAY, place: at });
    state = lines(state, events.map(([name, place]) => `+ world ${name} — trouble${place ? ` | place: ${place}` : ''}`).join('\n')).state;
    return sceneAt(clockAt(state, day * DAY), at);
}
