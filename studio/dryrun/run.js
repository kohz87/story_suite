// The Studio dry run: the world engine's pure daily step (`runDays`), run day by day on the author's pack for a seed, a tempo and a number of days.
// A port of scratch/lorecheck/sim.mjs without its strip step: the pack is run as written, and whatever the engine says about it (warnings) is shown.
// `simulate` is pure (the same seed gives the same days); `startDryRun` runs it in a Worker (studio/dryrun/worker.js) and can be cancelled.

import { runDays } from '../../modules/world/daily/step.js';
import { startDayOf, startWorldOf } from './start.js';

const MAX_DAYS = 3650;
const list = value => (Array.isArray(value) ? value : []);
const plain = value => JSON.parse(JSON.stringify(value ?? null));

/** The world the step reads, from a pack's content (the keys `readWorld` builds for a chat). `game` may carry `seasons`; the pack's start state (`content.start.world`, or the older `start.world`) is applied on day 1. */
export function worldOf(pack, game = null) {
    const content = pack?.content ?? {};
    const merged = rows => Object.assign({}, ...list(rows).filter(item => item && typeof item === 'object' && !Array.isArray(item)));
    const world = {
        places: list(content.places), routes: list(content.routes), realms: list(content.realms),
        placeKinds: merged(content.placeKinds), routeKinds: merged(content.routeKinds),
        conditions: list(content.conditions), events: [...list(content.worldEvents), ...list(content.events).filter(e => e && e.when === undefined && e.ends_when !== undefined)],
        templates: list(content.templates), powers: list(content.powers), scores: list(content.scores), cast: list(content.cast), lore: list(content.lore), regions: list(content.regions),
        seasons: list(game?.seasons ?? pack?.weather?.seasons).length ? list(game?.seasons ?? pack?.weather?.seasons) : null,
    };
    const begin = startWorldOf(pack);
    if (begin) world.startWorld = begin;
    return world;
}

/** The row of one stepped day: what fired, what the engine logged, who moved or died, what holds and where each power and score stands. */
function dayRow(day, out) {
    const report = out.report;
    return {
        day,
        fired: report.journal.filter(entry => entry.fired && entry.by).map(entry => entry.by),
        journal: plain(report.journal), log: plain(report.log), warnings: [...report.warnings],
        moves: plain(report.moves), deaths: plain(report.deaths),
        held: Object.values(out.conditions).map(entry => entry.name).sort(),
        standings: plain(out.daily.standings),
    };
}

/**
 * `simulate({ pack, game?, seed, tempo?, days, calendar?, onDay? })` → `{ seed, tempo, days, start, rows, finalEvents, warnings }`: day 1 to `days` stepped one at a time, from the world's start date.
 * `calendar` is the chat's calendar config (the step reads seasons and dates from it); none means Gregorian. `start` is `{ day, date }` (start.js): the first stepped day's absolute number and the start date, or `date: null` when the pack gives none (the run then begins on day 1). `onDay(day)` is called after each day.
 */
export function simulate({ pack, game = null, seed, tempo = 1, days, calendar = null, onDay = null }) {
    const count = Number.isInteger(days) ? Math.min(Math.max(days, 1), MAX_DAYS) : 1;
    const world = worldOf(pack, game);
    const campaign = String(seed ?? '');
    const start = startDayOf(pack, calendar);
    let state = null, table = {};
    const rows = [], warnings = new Set();
    for (let day = 1; day <= count; day += 1) {
        const out = runDays({ state, table, world, today: start.day + day - 1, seed: campaign, tempo, met: [], withYou: [], positions: null, calendar });
        if (out) {
            state = out.daily;
            table = out.conditions;
            rows.push(dayRow(day, out));
            for (const warning of out.report.warnings) warnings.add(warning);
        }
        if (onDay) onDay(day);
    }
    return { seed: campaign, tempo, days: count, start, rows, finalEvents: Object.fromEntries(Object.entries(state?.events ?? {}).map(([id, row]) => [id, row.state])), warnings: [...warnings] };
}

/**
 * `startDryRun(input, { make })` → `{ done, cancel }`: runs `simulate` in a Worker. `make()` returns the worker (the page passes `() => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`).
 * `done` resolves with the result, or rejects with the engine's error or "The dry run was cancelled."; `onProgress(day)` is called as days finish.
 */
export function startDryRun(input, { make, onProgress = null }) {
    const worker = make();
    let finish;
    const done = new Promise((resolve, reject) => {
        finish = { resolve, reject };
        worker.onmessage = event => {
            const message = event.data ?? {};
            if (message.progress !== undefined) onProgress?.(message.progress);
            else if (message.error !== undefined) { worker.terminate?.(); reject(new Error(message.error)); }
            else { worker.terminate?.(); resolve(message.result); }
        };
        worker.onerror = event => { worker.terminate?.(); reject(new Error(event?.message ?? 'The dry run failed.')); };
    });
    worker.postMessage(plain({ ...input, onDay: undefined }));
    return { done, cancel() { worker.terminate?.(); finish.reject(new Error('The dry run was cancelled.')); } };
}
