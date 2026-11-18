// The World screen's Elsewhere section (people/away, AWAYFOLLOW): the people away and the followed people not in the scene, read from
// `director.away.view`; read-only (no Pin / Unpin). Drawn from a real host's answer, so it fails if the section or its query goes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING, castHost, castSource, entry, followPeople, said } from '../../cast/cast/helpers.js';
import { drawWorld, squash } from './helpers.js';

const EMPTY_WORLD = { here: { place: null, moved: false, weather: '', people: [], present: [], chatter: [], nsd: false, hasPeople: false }, news: [], factions: [], upcoming: [], upcomingDays: 30, today: '', date: '', time: '', clockSet: true, hasNews: false, hasFactions: false, hasUpcoming: false, newsCount: 0, factionCount: 0 };

test('Elsewhere: someone away with their status, news and doing; a followed person not here with a star; folds with its count; no buttons', async t => {
    t.mock.method(console, 'log', () => {}); t.mock.method(console, 'warn', () => {});
    const host = await castHost({ source: castSource([entry('brom')]) });
    try {
        await host.send('Hello.', said('Dawn.', OPENING));
        await followPeople(host, [{ name: 'Mara' }]);
        await host.send('Go.', said('Ren leaves.', ['+ away Ren — scouting the north road | back: June 9']));
        await host.send('On.', said('News.', ['! away Ren — reached Wolfmere Outpost']));
        const drawn = drawWorld({ world: EMPTY_WORLD, journal: null, trip: null, threads: { on: true }, leads: { rows: [], has: false, count: 0 }, away: host.sdk.query('director.away.view') });
        assert.deepEqual(drawn.warnings, []);
        const section = drawn.el.querySelector('[data-fold="elsewhere"]');
        assert.ok(section, 'the section is drawn');
        assert.equal(squash(section.querySelector('.sd-fold-head').textContent), 'Elsewhere 2');
        const rows = section.querySelectorAll('.wv-key-row').map(row => squash(row.textContent));
        assert.deepEqual(rows, ['Ren Away · back June 9 reached Wolfmere Outpost News today', '★ Mara Not here']);
        assert.equal(section.querySelectorAll('button').filter(node => !node.classList?.contains?.('sd-fold-head')).length, 0, 'read-only');
        const none = drawWorld({ world: EMPTY_WORLD, journal: null, trip: null, threads: { on: true }, leads: { rows: [], has: false, count: 0 }, away: { people: [], elsewhere: 0, hasPeople: false } });
        assert.equal(none.el.querySelector('[data-fold="elsewhere"]'), null, 'nobody away or followed: no section');
    } finally { host.close(); }
});
