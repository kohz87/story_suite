// Test helpers for the world events daily step: a small world and a runner that steps it day by day with a controlled draw.

import { runDays } from '../../../../modules/world/daily/step.js';

const DAY = 1440;

/** A world with realms, regions, places and the conditions the acceptance tests use; `extra` overrides any part. */
export function world(extra = {}) {
    return {
        realms: [{ name: 'Highmark Empire', regions: ['Valegard', 'Highmark March'] }, { name: 'River Realm', regions: ['Lowfen'] }],
        places: [
            { name: 'Highmark Capital', region: 'Highmark March', kind: 'capital', x: 0, y: 0 },
            { name: 'Oakhollow', region: 'Valegard', kind: 'town', x: 10, y: 0 },
            { name: 'Town', region: 'Valegard', kind: 'town', x: 12, y: 0 },
            { name: 'Fenmouth', region: 'Lowfen', kind: 'city', x: 40, y: 0 },
            { name: 'Wild Camp', region: 'Thornwild', kind: 'outpost', x: 80, y: 0 },
            { name: 'Far Camp', region: 'Ashwild', kind: 'outpost', x: 90, y: 0 },
        ],
        conditions: [
            { name: 'crown-contested', scope: 'realm', fades: 'until cleared' },
            { name: 'truce', scope: 'realm', fades: 'until cleared' },
            { name: 'at-war', scope: 'realm', fades: 'until cleared' },
            { name: 'unrest', scope: 'place', fades: '10 days' },
            { name: 'peace', scope: 'place', fades: '10 days' },
            { name: 'grain-dear', scope: 'region', fades: '10 days' },
            { name: 'harvest-failed', scope: 'region', fades: 'until cleared' },
            { name: 'refugees', scope: 'region', fades: '20 days' },
            { name: 'regent-named', scope: 'realm', fades: 'until cleared' },
            { name: 'fallen', scope: 'place', fades: 'until cleared', placeStatus: true },
        ],
        powers: [{ name: 'Crown', start: 0 }],
        scores: [{ name: 'Stability', start: 0 }],
        events: [],
        templates: [],
        ...extra,
    };
}

/** `draw` that misses everything except `hits` ({ key: [days] } → 0) and `values` ({ key: (day) → number }). */
export function drawWith({ hits = {}, values = {} } = {}) {
    return (day, key) => {
        if (typeof values[key] === 'function') return values[key](day);
        return (hits[key] ?? []).includes(day) ? 0 : 0.999999;
    };
}

/**
 * A runner over `w` from `start` (nothing is stepped before the first `to`): `to(day)` steps one day at a time up to `day` (`jump: true` steps in one call), `set`/`clear`
 * act like a world line between replies, `row(id)` / `held(key)` read the state. Every report is kept in `reports`.
 */
export function runner(w, { start = 1, draw = drawWith(), tempo = 1, met = [], seed = 'test', calendar = null } = {}) {
    // `withYou` (cast ids), `positions` ({ id: { at, base } }) and `party` (the party's region) are what the host reads at the tick; a test sets them between steps.
    const self = { state: null, table: {}, reports: [], warnings: [], withYou: [], positions: null, party: '' };
    const step = today => {
        const out = runDays({ state: self.state, table: self.table, world: w, today, seed, tempo, met, draw, withYou: self.withYou, positions: self.positions, calendar, partyRegion: self.party });
        if (!out) return;
        self.state = out.daily;
        self.table = out.conditions;
        self.reports.push(out.report);
        self.warnings.push(...out.report.warnings);
    };
    self.to = (day, { jump = false } = {}) => {
        if (jump) step(day);
        else for (let d = self.state ? self.state.day + 1 : start; d <= day; d += 1) step(d);
        return self;
    };
    self.set = (name, ref, day, scope = 'realm') => { self.table[`${name}@${ref}`] = { name, scope, ref, since: day * DAY, fadesAt: null, why: '', by: 'narrator', rev: 0 }; return self; };
    self.clear = (name, ref) => { delete self.table[`${name}@${ref}`]; return self; };
    self.row = id => self.state.events[id] ?? null;
    self.log = (kind, key) => self.reports.flatMap(report => report.log).filter(entry => entry.kind === kind && (key === undefined || entry.key === key));
    self.journal = () => self.reports.flatMap(report => report.journal);
    return self;
}

/** Step day by day from `start` to `end`, recording the event's state after each day: { day: state }. */
export function states(w, id, { start = 1, end, draw, before = () => {} }) {
    const run = runner(w, { start, draw });
    const out = {};
    for (let day = start; day <= end; day += 1) {
        before(run, day);
        run.to(day);
        out[day] = run.row(id)?.state;
    }
    return out;
}
