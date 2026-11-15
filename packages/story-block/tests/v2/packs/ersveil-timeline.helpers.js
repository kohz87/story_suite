import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateCondition } from '../../../src/v2/events/condition.js';
import { rippleChoice } from '../../../src/v2/packs/content.js';

export const pack = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
export const OWN = ['bluewatch-guild-board', 'bluewatch-signal-braziers', 'the-turning-611', 'the-turning-612', 'the-turning-613', 'ghost-fleet-waters', 'wailing-battlefield-nights'];
export const events = pack.content.events;
export const beats = events.filter(event => !OWN.includes(event.id));
export const DAY = 1440;
export const T = (year, month, day, hour = 0) => year * 360 * DAY + (month - 1) * 30 * DAY + (day - 1) * DAY + hour * 60;
export const START = T(611, 5, 12, 6) + 40;
export const lastingOf = event => (event.then ?? []).filter(step => step.command === 'chronicle.lasting').map(step => step.payload);
export const written = new Set(beats.flatMap(event => lastingOf(event).map(payload => payload.name)));
export const delays = event => [...event.when.matchAll(/(?<!!)query\('chronicle\.passed', \{ name: "([^"]*)"/g)].map(match => match[1]);
// The Director's ripples part as the pack reads it: `sway` is [Wendhild, Corvin, Hasse] (pack order) or null for no ripples data (no Director or no table:
// the leader is null and the rows are []). `leader` follows leaderOf: a tie keeps the earlier power of the pack's table.
export const POWERS = ['wendhild', 'corvin', 'hasse'];
export const rowsOf = sway => (sway ? sway.map((value, index) => ({ id: POWERS[index], sway: value })) : []);
export const leaderOf = (sway, { among = POWERS, pick = 'top' } = {}) => {
    const pool = rowsOf(sway).filter(row => among.includes(row.id));
    if (!pool.length || !['top', 'bottom'].includes(pick)) return null;
    return pool.reduce((best, row) => ((pick === 'top' ? 1 : -1) * (row.sway - best.sway) > 0 ? row : best)).id;
};
// The view a condition reads: the clock, the place, the stand-in chronicle and the ripples.
export function view({ minutes, place, chronicle = new Map(), sway = null }) {
    return {
        state: { domains: { director: { time: { minutes } } } },
        query(name, args) {
            if (name === 'scene.place') return place;
            if (name === 'ripples.sway') return rowsOf(sway);
            if (name === 'ripples.leader') return leaderOf(sway, args);
            if (name === 'packs.rippleChoice') return rippleChoice([pack], args, { hasQuery: query => query === 'ripples.sway', query: () => rowsOf(sway) });
            if (name === 'chronicle.passed') return chronicle.has(args.name) && minutes >= chronicle.get(args.name).since + args.minutes;
            return null;
        },
    };
}

// Walk the clock at Bluewatch (or `place`), one reply every `step` story minutes, firing what is due like the engine does
// (an event fires once; an "after" link moves at most one step a reply), keeping the chronicle's "since" stamps and its
// states, pruning the oldest resolved entries past 30 like Story Director. `extra(minutes)` may add resolved entries of the story's own. Answers the ids fired, in order.
export function walk({ place = { name: 'Bluewatch Village', region: 'River Confederacy: Bluewatch' }, step = 6 * 60, extra = () => [], until = T(617, 1, 1), sway = () => null } = {}) {
    const chronicle = new Map();
    const fired = [];
    const done = new Set();
    const write = (name, state, minutes) => {
        const was = chronicle.get(name);
        chronicle.set(name, { since: was?.since ?? minutes, state, touched: minutes });
        const resolved = [...chronicle].filter(([, entry]) => entry.state === 'resolved').sort((a, b) => a[1].touched - b[1].touched);
        for (const [old] of resolved.slice(0, Math.max(0, resolved.length - 30))) chronicle.delete(old);
    };
    for (let minutes = START; minutes < until; minutes += step) {
        const before = new Set(done);
        const env = view({ minutes, place, chronicle, sway: sway(minutes) });
        for (const event of beats) {
            if (done.has(event.id) || (event.after && !before.has(event.after))) continue;
            const result = evaluateCondition(event.when, env);
            assert.equal(result.error, undefined, `${event.id}: ${JSON.stringify(result.error)}`);
            if (!result.met) continue;
            done.add(event.id); fired.push(event.id);
            for (const payload of lastingOf(event)) write(payload.name, payload.state, minutes);
        }
        for (const name of extra(minutes)) write(name, 'resolved', minutes);
    }
    return { fired, chronicle };
}

export const order = (fired, ids) => {
    for (const id of ids) assert.ok(fired.includes(id), `${id} fired`);
    assert.deepEqual(ids.map(id => fired.indexOf(id)), ids.map(id => fired.indexOf(id)).toSorted((a, b) => a - b), `in order: ${ids.join(' → ')}`);
};
export const variants = (fired, prefix) => fired.filter(id => id.startsWith(prefix) && !id.endsWith('-scene') && !id.includes('-news'));

// Which of the three branches and which reign a chat gets for a sway [Wendhild, Corvin, Hasse] held the whole time.
export const roadOf = sway => {
    const { fired } = walk({ sway: () => sway });
    return { fired, march: variants(fired, 'marrowbridge-'), crown: variants(fired, 'crown-') };
};

export const NEWS_REGIONS = ['Highmark Empire', 'Valegard', 'River Confederacy: core cities', 'River Confederacy: locks/connectors', 'Wallwright League', 'Kingdom of Ashmere',
    'Aurelion/Church Heartland', 'Silver Mark', 'Startrace Tower', 'Ironanvil'];
