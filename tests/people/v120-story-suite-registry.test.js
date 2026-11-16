import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AREAS, SUITE_VERSION, isSourceOfTruth, storySuite } from '../../modules/people/legacy/suite.js';
import {
    SUITE_AREAS,
    SUITE_ID,
    announceNpcStateDelta,
    areaOwner,
    buildManageApi,
    defersArea,
    normalizeSourceOfTruth,
    openSuiteOverlay,
    statLikeFieldNames,
    statsOverlapWarning,
    suiteManageAvailable,
} from '../../modules/people/legacy/suite-handshake.js';
import { fresh, provider } from './v120-story-suite.helpers.js';

test('v1.2.0 suite.js and docs/STORY_SUITE.md are the shared copies', () => {
    const suite = fs.readFileSync(new URL('../../modules/people/legacy/suite.js', import.meta.url), 'utf8');
    assert.match(suite, /^\/\/ Story Suite handshake, v1\. This file is identical in Story Block, Story Director, NPC State\n/);
    const doc = fs.readFileSync(new URL('../../docs/history/packages/npc-state-delta/docs/STORY_SUITE.md', import.meta.url), 'utf8');
    assert.match(doc, /^# Story Suite: working alone and together/);
    const runtime = JSON.parse(fs.readFileSync(new URL('../../modules/people/runtime/runtime-modules.json', import.meta.url), 'utf8'));
    assert.ok(runtime.modules.some(module => module.path === 'suite.js' && module.role === 'story-suite-registry'));
    assert.ok(runtime.modules.some(module => module.path === 'suite-handshake.js' && module.role === 'story-suite-handshake'));
    assert.match(fs.readFileSync(new URL('../../docs/history/packages/npc-state-delta/README.md', import.meta.url), 'utf8'), /docs\/STORY_SUITE\.md/);
});

test('v1.2.0 registry: announce, owner order, fallback and offering', () => {
    const suite = fresh();
    assert.equal(globalThis.StorySuite, suite);
    assert.equal(storySuite(), suite, 'the registry is created once and shared');
    assert.equal(suite.version, SUITE_VERSION);
    assert.equal(suite.owner('scene'), null);
    suite.announce({ id: '  ', owns: ['scene'] });
    assert.deepEqual(suite.providers(), [], 'an announcement without an id is ignored');

    suite.announce(provider('npc-state-delta', ['npc', 'calendar', 'scene', 'stats', 'npc']));
    assert.deepEqual(suite.providers()[0].owns, ['npc', 'calendar', 'scene', 'stats'], 'owns is de-duplicated');
    assert.equal(suite.owner('scene'), 'npc-state-delta', 'the fallback owns an area nobody else offers');
    suite.announce(provider('story-block', ['scene', 'items']));
    assert.equal(suite.owner('scene'), 'story-block', 'the specialist listed first wins');
    assert.deepEqual(suite.offering('scene'), ['story-block', 'npc-state-delta']);
    assert.equal(suite.owner('npc'), 'npc-state-delta');
    suite.announce(provider('story-director', ['npc', 'calendar']));
    assert.equal(suite.owner('npc'), 'npc-state-delta', 'Delta is first for npc');
    assert.equal(suite.owner('calendar'), 'story-director');
    suite.announce(provider('my-ext', ['weather']));
    assert.equal(suite.owner('weather'), 'my-ext', 'an area outside AREAS goes to whoever offers it');
    assert.equal(suite.owner('rolls'), null);

    suite.announce(provider('story-block', ['scene'], { enabled: false }));
    assert.equal(suite.owner('scene'), 'npc-state-delta', 'a disabled provider offers nothing');
    assert.equal(suite.has('story-block'), false);
    assert.equal(suite.has('story-director'), true);
    assert.deepEqual(Object.keys(AREAS), ['scene', 'npc', 'calendar', 'timeline', 'stats', 'items', 'rolls']);
    const copy = suite.providers()[0];
    copy.owns.push('rolls');
    assert.equal(suite.owner('rolls'), null, 'providers() returns copies');
});

test('v1.2.0 registry: api only while enabled, withdraw, onChange and unsubscribe', () => {
    const suite = fresh();
    const calls = [];
    const off = suite.onChange(() => calls.push('a'));
    suite.onChange(() => { throw new Error('a broken listener'); });
    const warn = console.warn;
    console.warn = () => {};
    try {
        suite.announce(provider('story-director', ['calendar'], { api: { calendar: () => ({ era: 'AR', months: [] }) } }));
        assert.deepEqual(calls, ['a'], 'a failing listener does not stop the others');
        assert.equal(typeof suite.api('story-director').calendar, 'function');
        assert.equal(suite.api('rpg-battle'), null);
        suite.announce(provider('story-director', ['calendar'], { enabled: false, api: { calendar: () => null } }));
        assert.equal(suite.api('story-director'), null, 'a disabled provider shares nothing');
        suite.withdraw('story-director');
        assert.equal(calls.length, 3);
        suite.withdraw('story-director');
        assert.equal(calls.length, 3, 'withdrawing an absent id does not notify');
        off();
        suite.announce(provider('rpg-battle', ['stats']));
        assert.equal(calls.length, 3, 'an unsubscribed listener is not called');
    } finally {
        console.warn = warn;
    }
});

test('v1.2.0 registry: a newer copy takes over an older registry with its providers and listeners', () => {
    delete globalThis.StorySuite;
    const heard = [];
    const older = {
        version: 0,
        snapshot: () => [['story-block', { id: 'story-block', name: 'Story Block', owns: ['scene'], enabled: true }]],
        listenersSnapshot: () => [() => heard.push('old listener')],
    };
    globalThis.StorySuite = older;
    const suite = storySuite();
    assert.notEqual(suite, older);
    assert.equal(suite.version, SUITE_VERSION);
    assert.equal(suite.owner('scene'), 'story-block', 'providers survive the upgrade');
    suite.announce(provider('npc-state-delta', ['scene']));
    assert.deepEqual(heard, ['old listener'], 'listeners survive the upgrade');
    const same = { version: SUITE_VERSION + 1, marker: true };
    globalThis.StorySuite = same;
    assert.equal(storySuite(), same, 'a newer registry is left alone');
    delete globalThis.StorySuite;
});

test('v1.2.0 isSourceOfTruth: auto, mine and theirs, alone and together', () => {
    const suite = fresh();
    for (const choice of ['auto', 'mine', 'theirs']) {
        assert.equal(isSourceOfTruth('npc-state-delta', 'scene', choice, suite), true, `alone, ${choice} behaves like Automatic`);
    }
    suite.announce(provider('npc-state-delta', ['npc', 'calendar', 'scene', 'stats']));
    for (const choice of ['auto', 'mine', 'theirs']) {
        assert.equal(isSourceOfTruth('npc-state-delta', 'scene', choice, suite), true, `announced alone, ${choice} keeps Delta`);
    }
    suite.announce(provider('story-block', ['scene']));
    assert.equal(isSourceOfTruth('npc-state-delta', 'scene', 'auto', suite), false);
    assert.equal(isSourceOfTruth('npc-state-delta', 'scene', 'mine', suite), true);
    assert.equal(isSourceOfTruth('npc-state-delta', 'scene', 'theirs', suite), false);
    assert.equal(isSourceOfTruth('story-block', 'scene', 'auto', suite), true);
    assert.equal(isSourceOfTruth('npc-state-delta', 'npc', 'theirs', suite), true, 'theirs with nobody else offering keeps this one');
    assert.equal(isSourceOfTruth('npc-state-delta', 'scene', undefined, suite), false, 'the default choice is auto');
    assert.equal(isSourceOfTruth('npc-state-delta', 'scene'), false, 'the default registry is the shared one');
});

test('v1.2.0 Delta announces its four areas while enabled; without a manage api it withdraws while disabled', () => {
    const suite = fresh();
    const api = { npcs: () => [] };
    assert.equal(announceNpcStateDelta({ enabled: true, version: '1.2.0', api }), true);
    const [entry] = suite.providers();
    assert.deepEqual({ id: entry.id, name: entry.name, version: entry.version, owns: entry.owns }, { id: 'npc-state-delta', name: 'NPC State Delta', version: '1.2.0', owns: ['npc', 'calendar', 'scene', 'stats'] });
    assert.equal(suite.api(SUITE_ID), api);
    assert.deepEqual(SUITE_AREAS, ['npc', 'calendar', 'scene', 'stats']);
    for (const area of ['calendar', 'scene', 'stats']) assert.equal(suite.owner(area), SUITE_ID, `alone, Delta owns ${area}`);
    suite.announce(provider('story-block', ['scene', 'stats']));
    suite.announce(provider('story-director', ['calendar', 'npc']));
    suite.announce(provider('rpg-battle', ['stats']));
    assert.equal(suite.owner('scene'), 'story-block');
    assert.equal(suite.owner('calendar'), 'story-director');
    assert.equal(suite.owner('stats'), 'rpg-battle');
    assert.equal(suite.owner('npc'), SUITE_ID, 'others win only where they are the specialist');
    assert.equal(announceNpcStateDelta({ enabled: false, version: '1.2.0' }), false);
    assert.equal(suite.has(SUITE_ID), false);
    assert.equal(suite.providers().some(item => item.id === SUITE_ID), false, 'disable withdraws the announcement');
    assert.equal(announceNpcStateDelta({ enabled: true, version: '1.2.0' }), true);
    assert.equal(suite.has(SUITE_ID), true, 'enable announces again');
    assert.equal(suite.api(SUITE_ID), null, 'without an api nothing is shared');
});

test('v1.2.1 disabled with api.manage, Delta stays announced as enabled: false with its panel and api', () => {
    const suite = fresh();
    const calls = [];
    const api = { npcs: () => [], manage: buildManageApi({ setEnabled: on => calls.push(on) }) };
    const settings = '#npc_state_delta_settings';
    assert.equal(announceNpcStateDelta({ enabled: true, version: '1.2.1', api, settings }), true);
    assert.deepEqual(suite.providers().map(({ id, enabled, settings: root }) => [id, enabled, root]), [[SUITE_ID, true, settings]]);
    suite.announce({ id: 'story-block', name: 'Story Block', owns: ['scene'] });
    assert.equal(suite.owner('scene'), 'story-block');
    assert.equal(suite.owner('npc'), SUITE_ID);

    assert.equal(announceNpcStateDelta({ enabled: false, version: '1.2.1', api, settings }), false);
    const off = suite.providers().find(item => item.id === SUITE_ID);
    assert.ok(off, 'disabled is announced, not withdrawn');
    assert.deepEqual([off.enabled, off.settings, off.version, off.owns], [false, settings, '1.2.1', ['npc', 'calendar', 'scene', 'stats']]);
    assert.equal(off.api, api, 'the overlay reads the api from providers()');
    assert.equal(suite.has(SUITE_ID), false);
    assert.equal(suite.api(SUITE_ID), null, 'a disabled provider shares nothing through api()');
    assert.equal(suite.owner('npc'), null, 'a disabled Delta owns nothing');
    assert.equal(suite.owner('scene'), 'story-block');
    off.api.manage.setEnabled(1);
    assert.deepEqual(calls, [true], 'the overlay can switch it back on');

    assert.equal(announceNpcStateDelta({ enabled: true, version: '1.2.1', api, settings }), true);
    assert.equal(suite.has(SUITE_ID), true);
    assert.equal(suite.owner('npc'), SUITE_ID);
    assert.equal(suite.providers().length, 2);
    assert.equal(announceNpcStateDelta({ enabled: true, version: '1.2.1' }), true);
    assert.equal('settings' in suite.providers().find(item => item.id === SUITE_ID), false, 'no panel, no settings field');
    assert.equal(announceNpcStateDelta({ enabled: true }, { announce() { throw new Error('broken'); } }), false, 'a broken registry is reported, not thrown');
});

test('v1.2.1 api.manage validates, copies and forwards to Delta\'s own settings actions', () => {
    let stored = { scene: 'mine', stats: 'bogus' };
    let enabled = true;
    const sets = [];
    const toggles = [];
    const manage = buildManageApi({
        sources: () => stored,
        setSource: (area, choice) => { sets.push([area, choice]); stored = { ...stored, [area]: choice }; },
        enabled: () => enabled,
        setEnabled: on => { toggles.push(on); enabled = on; },
    });
    assert.deepEqual(manage.areas, ['npc', 'calendar', 'scene', 'stats']);
    assert.deepEqual(manage.sources(), { npc: 'auto', calendar: 'auto', scene: 'mine', stats: 'auto' }, 'normalized');
    manage.sources().npc = 'theirs';
    assert.equal(manage.sources().npc, 'auto', 'sources() is a copy');
    assert.throws(() => manage.areas.push('items'), TypeError, 'areas cannot be changed by a reader');
    assert.throws(() => { manage.setSource = null; }, TypeError, 'nor can the api');
    assert.equal(manage.setSource('calendar', 'theirs'), true);
    assert.equal(manage.sources().calendar, 'theirs');
    for (const [area, choice] of [['items', 'mine'], ['scene', 'nonsense'], ['', 'auto'], [undefined, undefined]]) {
        assert.equal(manage.setSource(area, choice), false, `${area}/${choice} is refused`);
    }
    assert.deepEqual(sets, [['calendar', 'theirs']], 'refused choices never reach the settings');
    assert.equal(manage.enabled(), true);
    manage.setEnabled(0);
    assert.deepEqual(toggles, [false], 'setEnabled passes a boolean');
    assert.equal(manage.enabled(), false);
    const bare = buildManageApi();
    assert.deepEqual(bare.sources(), normalizeSourceOfTruth());
    assert.equal(bare.enabled(), true);
    assert.equal(bare.setSource('npc', 'mine'), true);
    assert.doesNotThrow(() => bare.setEnabled(true));
});

test('v1.2.1 "Manage all in Story Suite" needs two providers and Story Block\'s openSuite', () => {
    const suite = fresh();
    assert.equal(suiteManageAvailable(), false, 'alone there is no overlay');
    assert.equal(openSuiteOverlay(), false);
    announceNpcStateDelta({ enabled: true, version: '1.2.1' }, suite);
    assert.equal(suiteManageAvailable(), false);
    const opened = [];
    suite.announce({ id: 'story-block', name: 'Story Block', owns: ['scene'], api: { openSuite: tab => opened.push(tab) } });
    assert.equal(suiteManageAvailable(), true);
    assert.equal(openSuiteOverlay(), true);
    assert.deepEqual(opened, ['npc-state-delta'], 'opens on Delta\'s tab');
    suite.withdraw(SUITE_ID);
    assert.equal(suiteManageAvailable(), false, 'Story Block alone has no overlay');
    suite.announce({ id: SUITE_ID, name: 'NPC State Delta', owns: ['npc'], enabled: false });
    assert.equal(suiteManageAvailable(), true, 'a switched-off extension still counts');
    suite.announce({ id: 'story-block', name: 'Story Block', owns: ['scene'], api: {} });
    assert.equal(suiteManageAvailable(), false, 'an older Story Block without openSuite shows no line');
    suite.announce({ id: 'story-block', name: 'Story Block', owns: ['scene'], enabled: false, api: { openSuite: () => {} } });
    assert.equal(suiteManageAvailable(), false, 'a switched-off Story Block shares no overlay');
    suite.announce({ id: 'story-block', name: 'Story Block', owns: ['scene'], api: { openSuite: () => { throw new Error('boom'); } } });
    const warn = console.warn;
    console.warn = () => {};
    try {
        assert.equal(openSuiteOverlay(), false, 'a failing overlay is reported, not thrown');
    } finally {
        console.warn = warn;
    }
    assert.equal(suiteManageAvailable({ providers() { throw new Error('broken'); } }), false);
    delete globalThis.StorySuite;
});

test('v1.2.0 source-of-truth choices normalize to auto and drive defersArea / areaOwner', () => {
    assert.deepEqual(normalizeSourceOfTruth(), { npc: 'auto', calendar: 'auto', scene: 'auto', stats: 'auto' });
    assert.deepEqual(normalizeSourceOfTruth({ scene: 'theirs', stats: 'bogus', calendar: 'mine', extra: 'x' }), { npc: 'auto', calendar: 'mine', scene: 'theirs', stats: 'auto' });
    assert.deepEqual(normalizeSourceOfTruth(['mine']), normalizeSourceOfTruth());
    const suite = fresh();
    announceNpcStateDelta({ enabled: true, version: '1.2.0' }, suite);
    for (const area of SUITE_AREAS) {
        for (const choice of ['auto', 'mine', 'theirs']) assert.equal(defersArea(area, { [area]: choice }), false, `alone: ${area}/${choice}`);
    }
    assert.equal(areaOwner('scene', {}), null);
    suite.announce({ id: 'story-block', name: 'Story Block', version: '0.8.0', owns: ['scene'] });
    assert.equal(defersArea('scene', {}), true);
    assert.deepEqual(areaOwner('scene', {}), { id: 'story-block', name: 'Story Block' });
    assert.equal(defersArea('scene', { scene: 'mine' }), false, 'This extension keeps Delta');
    assert.equal(defersArea('npc', { npc: 'theirs' }), false, 'nobody else offers npc');
    suite.announce({ id: 'story-director', name: 'Story Director', owns: ['npc'] });
    assert.deepEqual(areaOwner('npc', { npc: 'theirs' }), { id: 'story-director', name: 'Story Director' }, 'The other one names the other');
    assert.equal(defersArea('scene', {}, { offering: () => { throw new Error('broken'); } }), false, 'a broken registry never defers');
});

test('v1.2.0 stats: game-stat-like custom field names are detected as whole words', () => {
    assert.deepEqual(statLikeFieldNames(['Level', 'Faction', 'Max HP', 'class', 'Rank', 'Lv', 'STR', 'Interests', 'Classified', 'Home town', 'Exp.']), ['Level', 'Max HP', 'class', 'Rank', 'Lv', 'STR', 'Exp.']);
    assert.deepEqual(statLikeFieldNames(['Title', 'Hometown', 'Dexterous', 'Strengths']), [], 'only whole words count');
    assert.deepEqual(statLikeFieldNames(['luk', 'MP', 'xp', 'VIT', 'agi', 'DEX', 'INT', 'cha']), ['luk', 'MP', 'xp', 'VIT', 'agi', 'DEX', 'INT', 'cha']);
    assert.deepEqual(statLikeFieldNames(null), []);

    const suite = fresh();
    announceNpcStateDelta({ enabled: true, version: '1.2.0' }, suite);
    assert.equal(statsOverlapWarning(['Level', 'Faction'], {}), '', 'alone, Delta keeps its custom fields quietly');
    suite.announce({ id: 'rpg-battle', name: 'RPG Battle', owns: ['stats'] });
    assert.equal(statsOverlapWarning(['Level', 'Faction', 'HP'], {}), 'RPG Battle keeps game stats. Level, HP may duplicate or contradict it; consider removing those fields here.');
    assert.match(statsOverlapWarning(['Class'], {}), /Class may duplicate or contradict it; consider removing that field here\./);
    assert.equal(statsOverlapWarning(['Faction'], {}), '', 'no stat-like name, no warning');
    assert.equal(statsOverlapWarning(['Level'], { stats: 'mine' }), '', 'This extension silences the warning');
});
