// Tests for src/routes.js: shortest routes, rest-day rules, leg parsing and validation, and formatting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    exitsFrom, paceFor, shortestPath, planRoute, parseLeg, validateLeg, formatRoute, formatLeg,
} from '../src/routes.js';
import { at, cal, check, hopsText, kinds, pack } from './routes.helpers.js';

// ---------------------------------------------------------------------------------------
// Routes

test('Shorn → Auvoth, ride: 220 km along the Bastion Road', () => {
    const plan = planRoute(pack, 'Shorn', 'Auvoth', { mode: 'ride' });
    assert.equal(plan.km, 220);
    assert.deepEqual(hopsText(plan), ['Varnhold Watch 35 B', 'Wolfmere Outpost 55 B', 'Auvoth 130 B']);
    assert.deepEqual(plan.hops.map(hop => hop.days), [1, 2, 4]);
    assert.equal(plan.activeDays, 7);
    assert.equal(plan.restDays, 1);
    assert.equal(plan.days, 8);
    assert.equal(plan.depart, null);
    assert.equal(plan.arrive, null);
});

test('Wolfmere Outpost → Bluewatch Village, ride: 160 km via Hollin\'s Reach, 7.5 days', () => {
    const plan = planRoute(pack, 'Wolfmere Outpost', 'Bluewatch Village', { mode: 'ride' });
    assert.equal(plan.km, 160);
    assert.deepEqual(hopsText(plan), ['Hollin\'s Reach 60 F', 'Bluewatch Village 100 F']);
    assert.deepEqual(plan.hops.map(hop => [hop.rate, hop.days]), [[28, 2.5], [28, 4]]);
    assert.equal(plan.activeDays, 6.5);
    assert.equal(plan.restDays, 1);
    assert.equal(plan.days, 7.5);
    // The road via Auvoth exists but is longer (130 + 70 = 200 km).
    assert.ok(exitsFrom(pack, 'Wolfmere Outpost').some(e => e.to === 'Auvoth' && e.km === 130));
    assert.ok(exitsFrom(pack, 'Auvoth').some(e => e.to === 'Bluewatch Village' && e.km === 70));
    assert.ok(plan.km < 200);
});

test('ferry, Bluewatch Village → Glassdock, boat at 35: 13 days, no rest', () => {
    const plan = planRoute(pack, 'Bluewatch Village', 'Glassdock', { mode: 'boat', rate: 35 });
    assert.deepEqual(hopsText(plan), ['Glassdock 440 W']);
    assert.equal(plan.activeDays, 13);
    assert.equal(plan.restDays, 0);
    assert.equal(plan.days, 13);
    // Without a rate the range midpoint (37.5) is used.
    assert.equal(planRoute(pack, 'Bluewatch Village', 'Glassdock', { mode: 'boat' }).days, 12);
});

test('crewed boats rest only when the pack says so', () => {
    const crewed = { ...pack, rules: { ...pack.rules, crewedWaterRest: true } };
    assert.equal(planRoute(crewed, 'Bluewatch Village', 'Glassdock', { mode: 'boat', rate: 35 }).restDays, 2);
});

test('wagon, Bluewatch Village → Auvoth: 70 km F at 14, 5 days', () => {
    const plan = planRoute(pack, 'Bluewatch Village', 'Auvoth', { mode: 'wagon' });
    assert.deepEqual(hopsText(plan), ['Auvoth 70 F']);
    assert.equal(plan.hops[0].rate, 14);
    assert.equal(plan.days, 5);
});

test('foot, Bluewatch → Auvoth from Goldwane 13 09:00 arrives Goldwane 17 at 09:00 pm', () => {
    const plan = planRoute(pack, 'Bluewatch', 'Auvoth', { mode: 'foot', depart: at('Goldwane 13, 09:00 am'), calendar: cal });
    assert.equal(plan.from, 'Bluewatch Village');
    assert.equal(plan.days, 4.5);
    assert.equal(cal.format(plan.arrive, { era: false }), 'Goldwane 17, 09:00 pm');
    // depart may also be a date text when a calendar is given.
    const fromText = planRoute(pack, 'Bluewatch', 'Auvoth', { mode: 'foot', depart: 'Goldwane 13, 09:00 am', calendar: cal });
    assert.equal(fromText.arrive, plan.arrive);
});

test('courier on B: 35 × 2 = 70 a day, no rest days', () => {
    assert.deepEqual(paceFor(pack, 'B', 'courier'), { rate: 70, low: 70, high: 70 });
    const hop = planRoute(pack, 'Shorn', 'Varnhold Watch', { mode: 'courier' });
    assert.equal(hop.km, 35);
    assert.equal(hop.days, 0.5);
    const long = planRoute(pack, 'Ledgerford', 'Auvoth', { mode: 'courier' });
    assert.ok(long.activeDays > 6);
    assert.equal(long.restDays, 0);
});

test('between two places with several roads, the mode takes the quickest it can use', () => {
    assert.deepEqual(hopsText(shortestPath(pack, 'Ledgerford', 'Northledger Depot', { mode: 'foot' })), ['Northledger Depot 50 B']);
    assert.deepEqual(hopsText(shortestPath(pack, 'Ledgerford', 'Northledger Depot', { mode: 'boat' })), ['Northledger Depot 55 W']);
    assert.deepEqual(hopsText(shortestPath(pack, 'Northledger Depot', 'Frostgate', { mode: 'boat' })), ['Frostgate 80 W']);
});

test('shortestPath gives null for unknown places or modes, and an empty route in place', () => {
    assert.equal(shortestPath(pack, 'Shorn', 'Nowhere'), null);
    assert.equal(shortestPath(pack, 'Shorn', 'Auvoth', { mode: 'teleport' }), null);
    assert.equal(planRoute(pack, 'Shorn', 'Glassdock', { mode: 'ship' }), null);
    assert.deepEqual(shortestPath(pack, 'Shorn', 'Shorn'), { from: 'Shorn', to: 'Shorn', km: 0, hops: [] });
    assert.equal(shortestPath(pack, 'Shorn', 'Auvoth', { mode: 'Riding' }).km, 220);
});

// ---------------------------------------------------------------------------------------
// Formatting

test('formatRoute prints hops, total, pace, days and arrival', () => {
    const plan = planRoute(pack, 'Shorn', 'Auvoth', { mode: 'ride', depart: at('Haywane 12, 09:00 am'), calendar: cal });
    assert.equal(formatRoute(plan, cal),
        'Shorn → Varnhold Watch 35 B → Wolfmere Outpost 55 B → Auvoth 130 B = 220 km · ride 35/day · '
        + '7 active days + 1 rest = 8 days · arrive Haywane 20, 09:00 am');
    // No calendar, no arrival; no rest, no breakdown.
    assert.equal(formatRoute(planRoute(pack, 'Bluewatch Village', 'Glassdock', { mode: 'boat', rate: 35 })),
        'Bluewatch Village → Glassdock 440 W = 440 km · boat 35/day · 13 days');
    assert.equal(formatRoute(planRoute(pack, 'Shorn', 'Varnhold Watch', { mode: 'courier' })),
        'Shorn → Varnhold Watch 35 B = 35 km · courier 70/day · 0.5 day');
    // Mixed paces print as a range.
    assert.match(formatRoute(planRoute(pack, 'Bluewatch Village', 'Shorn', { mode: 'foot' })), / · foot 16–20\/day · /);
    assert.equal(formatRoute(null), '');
});

test('formatLeg writes one hop in the line grammar', () => {
    const hop = { from: 'Shorn', to: 'Varnhold Watch', km: 35, code: 'B' };
    assert.equal(formatLeg(hop, { mode: 'courier', rate: 70, days: 0.5 }), 'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5');
    assert.equal(formatLeg(hop, { mode: 'courier', rate: 70, days: 0.5, arrive: at('Haywane 13, 09:00 am'), calendar: cal }),
        'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5 | arrive: Haywane 13, 09:00 am');
    assert.equal(formatLeg(hop, { mode: 'courier', rate: 70, days: 0.5, arrive: 'Haywane 13, morning' }),
        'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5 | arrive: Haywane 13, morning');
    // A plan hop carries its own rate and days.
    const planHop = planRoute(pack, 'Bluewatch Village', 'Auvoth', { mode: 'wagon' }).hops[0];
    assert.equal(formatLeg(planHop, { mode: 'wagon' }), 'Bluewatch Village → Auvoth 70 F, wagon 14/day → 5');
});

// ---------------------------------------------------------------------------------------
// Legs

test('parseLeg reads the leg grammar', () => {
    assert.deepEqual(parseLeg(pack, 'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5'), {
        text: 'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5',
        from: 'Shorn', to: 'Varnhold Watch', km: 35, code: 'B', mode: 'courier', rate: 70, days: 0.5,
        fromText: 'Shorn', toText: 'Varnhold Watch',
    });
    const wagon = parseLeg(pack, 'Bluewatch → Auvoth 70 F, wagon 14/day → 5');
    assert.deepEqual([wagon.from, wagon.to, wagon.km, wagon.code, wagon.mode, wagon.rate, wagon.days],
        ['Bluewatch Village', 'Auvoth', 70, 'F', 'wagon', 14, 5]);
});

test('parseLeg accepts ->, to, the legacy bracket and missing pieces', () => {
    const arrow = parseLeg(pack, 'Shorn -> Varnhold Watch 35 km B, riding 35 km/day -> 1 day');
    assert.deepEqual([arrow.to, arrow.km, arrow.code, arrow.mode, arrow.rate, arrow.days], ['Varnhold Watch', 35, 'B', 'ride', 35, 1]);
    const to = parseLeg(pack, 'Hollin’s Reach to Wolfmere Outpost, on foot');
    assert.deepEqual([to.from, to.to, to.km, to.code, to.mode], ['Hollin\'s Reach', 'Wolfmere Outpost', null, null, 'foot']);
    const legacy = parseLeg(pack, 'rides south (Shorn → Auvoth, 130 km B)');
    assert.deepEqual([legacy.from, legacy.to, legacy.km, legacy.code, legacy.mode, legacy.days], ['Shorn', 'Auvoth', 130, 'B', null, null]);
    const corrected = parseLeg(pack, '**Shorn → Varnhold Watch 35 B, courier 70/day → 0.5** | arrive: Haywane 13, morning');
    assert.deepEqual([corrected.to, corrected.days], ['Varnhold Watch', 0.5]);
    const unknown = parseLeg(pack, 'Shorn → Nowhere 20 R');
    assert.deepEqual([unknown.from, unknown.to, unknown.toText], ['Shorn', null, 'Nowhere']);
    assert.equal(parseLeg(pack, 'stays in Shorn'), null);
    assert.equal(parseLeg(pack, ''), null);
});

test('a whole road as one leg is leg-not-one-hop, with the first hop and the path', () => {
    const findings = check('Shorn → Auvoth 130 km B');
    assert.deepEqual(kinds(findings), ['leg-not-one-hop']);
    const [f] = findings;
    assert.equal(f.severity, 'error');
    assert.equal(f.key, null);
    assert.deepEqual(f.firstHop, { from: 'Shorn', to: 'Varnhold Watch', km: 35, code: 'B', corridor: 'Shorn–Auvoth Bastion Road' });
    assert.equal(f.path.km, 220);
    assert.match(f.correction, /^Shorn → Varnhold Watch 35 B, /);

    // With the courier's working and a departure, the correction is complete.
    const courier = check('Shorn → Auvoth 130 km B, courier 70/day → 2', { depart: at('Haywane 13, 06:00 am') });
    assert.equal(courier[0].correction, 'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5 | arrive: Haywane 13, 06:00 pm');
});

test('an invented road is leg-no-edge with the exits; without a code, the mode decides', () => {
    // Siltbarrow is in the pack, but there is no L road out of Bluewatch Village.
    const findings = check('Bluewatch Village → Siltbarrow 130 L');
    assert.deepEqual(kinds(findings), ['leg-no-edge']);
    assert.equal(findings[0].severity, 'error');
    assert.equal(findings[0].correction, undefined);
    assert.deepEqual(findings[0].exits.map(e => `${e.to} ${e.km} ${e.code}`), ['Glassdock 440 W', 'Auvoth 70 F', 'Hollin\'s Reach 100 F']);
    assert.match(findings[0].message, /Glassdock 440 W, Auvoth 70 F, Hollin's Reach 100 F/);

    // By boat there is no way: the last stretch to Siltbarrow is a local road.
    assert.deepEqual(kinds(check('Bluewatch Village → Siltbarrow, boat')), ['leg-no-edge']);
    // On foot a (long) path exists, so it is not one hop.
    const foot = check('Bluewatch Village → Siltbarrow, foot');
    assert.deepEqual(kinds(foot), ['leg-not-one-hop']);
    assert.ok(foot[0].path.hops.every(hop => hop.corridor !== 'Bluewatch Branch'));
});

test('leg-wrong-start: the leg starts somewhere other than from', () => {
    const findings = check('Varnhold Watch → Wolfmere Outpost 55 B, ride 35/day → 2', { from: 'Shorn' });
    assert.deepEqual(kinds(findings), ['leg-wrong-start']);
    assert.equal(findings[0].severity, 'error');
    assert.equal(findings[0].correction, 'Shorn → Varnhold Watch 35 B, ride 35/day → 1');
    // from may be free text naming the place.
    assert.deepEqual(check('Varnhold Watch → Wolfmere Outpost 55 B, ride 35/day → 2', { from: 'resting at Varnhold Watch' }), []);
});

test('leg-mode: the mode cannot use the road', () => {
    const wagon = check('Bluewatch Village → Glassdock 440 W, wagon 14/day → 32');
    assert.deepEqual(kinds(wagon), ['leg-mode']);
    assert.equal(wagon[0].severity, 'error');
    assert.ok(wagon[0].path.hops.every(hop => hop.corridor !== 'Bluewatch Branch'));
    assert.ok(wagon[0].correction.startsWith('Bluewatch Village → '));
    // Another road between the same places is the correction.
    const foot = check('Ledgerford → Northledger Depot 55 W, foot 20/day → 3');
    assert.deepEqual(kinds(foot), ['leg-mode']);
    assert.equal(foot[0].correction, 'Ledgerford → Northledger Depot 50 B, foot 20/day → 2.5');
});

test('leg-km: off by more than 5 %', () => {
    const off = check('Shorn → Varnhold Watch 40 B, courier 70/day → 0.5');
    assert.deepEqual(kinds(off), ['leg-km']);
    assert.equal(off[0].severity, 'warn');
    assert.equal(off[0].correction, 'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5');
    assert.deepEqual(check('Shorn → Varnhold Watch 36 B, courier 70/day → 0.5'), []);
});

test('leg-arrive: off by more than half a day', () => {
    const depart = at('Goldwane 13, 09:00 am');
    const leg = 'Bluewatch → Auvoth 70 F, foot 16/day → 4.5';
    const early = check(leg, { depart, arrive: 'Goldwane 16, morning' });
    assert.deepEqual(kinds(early), ['leg-arrive']);
    assert.equal(early[0].severity, 'warn');
    assert.equal(early[0].correction, 'Bluewatch Village → Auvoth 70 F, foot 16/day → 4.5 | arrive: Goldwane 17, 09:00 pm');
    assert.deepEqual(check(leg, { depart, arrive: 'Goldwane 17, evening' }), []);
    // A day without a time covers the whole day.
    assert.deepEqual(check(leg, { depart, arrive: 'Goldwane 17' }), []);
    assert.deepEqual(check(leg, { depart, arrive: at('Goldwane 17, 09:00 pm') }), []);
    assert.deepEqual(kinds(check(leg, { depart, arrive: at('Goldwane 19, 09:00 am') })), ['leg-arrive']);
});

test('Ledgerford–Northledger Depot: the named code picks the road', () => {
    assert.deepEqual(check('Ledgerford → Northledger Depot 50 B, ride 35/day → 1.5'), []);
    assert.deepEqual(check('Ledgerford → Northledger Depot 55 W, boat 35/day → 2'), []);
    // 55 km is right for the W, but the leg names the B (50 km).
    const km = check('Ledgerford → Northledger Depot 55 B, ride 35/day → 1.5');
    assert.deepEqual(kinds(km), ['leg-km']);
    assert.match(km[0].correction, /50 B/);
});

test('beyond the contract: leg-code, leg-rate, leg-days, leg-unknown-place', () => {
    const code = check('Ledgerford → Northledger Depot 50 R, ride 35/day → 1.5');
    assert.deepEqual(kinds(code), ['leg-code']);
    assert.equal(code[0].correction, 'Ledgerford → Northledger Depot 50 B, ride 35/day → 1.5');

    const rate = check('Shorn → Varnhold Watch 35 B, courier 100/day → 0.5');
    assert.deepEqual(kinds(rate), ['leg-rate']);
    assert.equal(rate[0].correction, 'Shorn → Varnhold Watch 35 B, courier 70/day → 0.5');
    // A rate inside the boat range (or the upstream range) is accepted.
    assert.deepEqual(check('Bluewatch Village → Glassdock 440 W, boat 35/day → 13'), []);
    assert.deepEqual(check('Bluewatch Village → Glassdock 440 W, boat 22/day → 20'), []);

    assert.deepEqual(kinds(check('Shorn → Varnhold Watch 35 B, courier 70/day → 3')), ['leg-days']);

    const unknown = check('Shorn → Nowhere 20 R, foot');
    assert.deepEqual(kinds(unknown), ['leg-unknown-place']);
    assert.equal(unknown[0].severity, 'warn');
    assert.match(unknown[0].message, /"Nowhere".*Exits from Shorn/);
});

test('validateLeg without speed checks only the road, and takes leg text too', () => {
    // A legacy leg says nothing about speed, so no days or arrival are checked.
    assert.deepEqual(check('(Shorn → Varnhold Watch, 35 km B)', { depart: at('Goldwane 13'), arrive: 'Goldwane 20' }), []);
    assert.deepEqual(kinds(validateLeg(pack, 'Shorn → Auvoth 130 km B')), ['leg-not-one-hop']);
    assert.deepEqual(validateLeg(null, 'Shorn → Auvoth'), []);
    assert.deepEqual(validateLeg(pack, null), []);
});
