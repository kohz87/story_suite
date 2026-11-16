import test from 'node:test';
import assert from 'node:assert/strict';
import {
    announceNpcStateDelta,
    externalCalendar,
} from '../../modules/people/legacy/suite-handshake.js';
import { buildInjection, getActiveCalendarConfig, setActiveCalendarConfig, setExternalCalendarSource, stripUiNoise } from '../../modules/people/core/core.js';
import { deterministicCalendarBirthday } from '../../modules/people/legacy/calendar.js';
import { runtimeSource } from './helpers/runtime-source.js';
import { styleSource } from './helpers/shipped-modules.js';
import { fresh, runHostScenario } from './v120-story-suite.helpers.js';

// Story Block writes its blocks into one hidden comment at the end of the reply (src/envelope.js);
// blocks kept by another extension carry a kept="Owner" stamp on their opening tag.
const WORLD_STATE = [
    '<World_State>',
    '**📅 Time:** 1022 AR, Redleaf 4, dusk | **🌤 Loc:** Harbor Gate | Saltmere | **🌡 Wx:** Fog, cold, lanterns',
    '---',
    '**👥 NPCs Present:**',
    '**Mira Vale:**',
    '* *Outfit:* Grey oilskin cloak over harbor-watch leathers',
    '* *Position:* Leaning on the gate winch',
    '* *Mood:* Wary, tired',
    '---',
    '**📡 Off-Screen:**',
    '* Old Brenn counts crates at the warehouse',
    '</World_State>',
].join('\n');
const ENVELOPE = [
    '<!-- STORY_BLOCKS_V1',
    '<Blocks>',
    '<Inventory>',
    'Coin Pouch | 1 | 85 Gold',
    '</Inventory>',
    '<Character kept="RPG Battle">',
    'HP: 62/62 | MP: 30/30',
    '</Character>',
    WORLD_STATE,
    '</Blocks>',
    '-->',
].join('\n');

test('v1.2.0 World State inside Story Block\'s hidden envelope reads like a plain <Blocks>', () => {
    const story = 'Mira lowers the lantern. "Gate closes at dark."';
    const plain = stripUiNoise(`${story}\n<Blocks>\n${WORLD_STATE}\n</Blocks>`);
    const enveloped = stripUiNoise(`${story}\n${ENVELOPE}`);
    assert.match(enveloped, /World State: \*\*📅 Time:\*\* 1022 AR, Redleaf 4, dusk/);
    assert.match(enveloped, /Mira Vale:\*\* \* \*Outfit:\* Grey oilskin cloak/);
    assert.match(enveloped, /Old Brenn counts crates/);
    assert.equal(enveloped, plain, 'the envelope is read exactly as the plain Megumin layout');
    assert.doesNotMatch(enveloped, /Coin Pouch|HP: 62|STORY_BLOCKS_V1|-->/, 'other blocks and the comment itself stay out');

    // A kept World State, Delta's own capture comment before it, and other comments.
    const kept = ENVELOPE.replace('<World_State>', '<World_State kept="Some Extension">');
    assert.equal(stripUiNoise(`${story}\n${kept}`), plain);
    const capture = '<!--npc_state_delta {"npcs":[]} -->';
    assert.equal(stripUiNoise(`${story}\n${capture}\n${ENVELOPE}`), plain);
    assert.equal(stripUiNoise(`${story}\n<!-- author note: Mira is a spy -->`), story, 'other comments are still stripped');
    assert.equal(stripUiNoise(`${story}\n<!-- STORY_BLOCKS_V1_CONTEXT_BEGIN -->`), story);

    // A reply cut off mid-envelope still yields what was written, as a cut plain <Blocks> does.
    const cut = ENVELOPE.split('\n').slice(0, -6).join('\n');
    assert.match(stripUiNoise(`${story}\n${cut}`), /World State: [\s\S]*Grey oilskin cloak/);
    // Without an envelope the reading is unchanged.
    assert.equal(stripUiNoise(story), story);
});

const MIRA = {
    id: 'npc_mira', name: 'Mira Vale', present: true, role: 'harbor watch captain', gender: 'female',
    personality: 'Dry, protective, slow to trust strangers.', speech: 'Clipped sentences, harbor slang.',
    goal: 'Keep the gate shut after dark', mood: 'wary, tired', status: 'favoring her left arm',
    keyRelationships: ['Old Brenn | mentor | gruff respect'], customFields: { Faction: 'Harbor Watch' },
    overallAppearance: 'Tall woman, weathered skin, a scar through the left eyebrow',
    appearance: 'Tall woman, weathered skin, a scar through the left eyebrow; grey oilskin cloak over watch leathers',
    lastSeenTurn: 3, seenCount: 3,
};

test('v1.2.0 scene deferred: present cards drop the live mood and the current outfit, nothing else', () => {
    const args = [[MIRA], 'Mira Vale waits at the gate.', 3, 3, undefined, 4000, null];
    const own = buildInjection(...args, { customFieldNames: ['Faction'] });
    assert.match(own, /mood: wary, tired/);
    assert.match(own, /grey oilskin cloak/);
    assert.equal(buildInjection(...args, { customFieldNames: ['Faction'], sceneDeferred: false }), own, 'off is the 1.1.12 injection');

    const deferred = buildInjection(...args, { customFieldNames: ['Faction'], sceneDeferred: true });
    assert.doesNotMatch(deferred, /mood: wary|grey oilskin|APPEARANCE \(authoritative/);
    assert.match(deferred, /; STATE: status: favoring her left arm; live mood\/outfit: as in World State;/);
    assert.match(deferred, /PHYSICAL FEATURES \(authoritative\): Tall woman, weathered skin, a scar through the left eyebrow/);
    for (const kept of [/personality: Dry, protective/, /speech: Clipped sentences/, /goal: Keep the gate shut/, /bonds: Old Brenn/, /established details: Faction: Harbor Watch/, /role: harbor watch captain/]) {
        assert.match(deferred, kept);
    }

    // A selected form's appearance is its whole anatomy: kept, with World State named for the outfit.
    const formed = { ...MIRA, overallAppearance: '', appearance: '', appearanceForms: [{ name: 'Selkie', appearance: 'Sleek grey seal-woman, webbed hands, a seal-skin mantle' }], currentForm: 'Selkie' };
    const formDeferred = buildInjection([formed], ...args.slice(1), { sceneDeferred: true });
    assert.match(formDeferred, /FORM ANATOMY \(authoritative; World State gives the outfit\): Sleek grey seal-woman/);
    // No mood, no status: the state still points at World State rather than claiming none.
    const quiet = buildInjection([{ ...MIRA, mood: '', status: '' }], ...args.slice(1), { sceneDeferred: true });
    assert.match(quiet, /; STATE: live mood\/outfit: as in World State;/);
});

test('v1.2.0 calendar deferred: Story Director\'s months and era replace Delta\'s own, with graceful fallback', () => {
    const local = { era: 'CR', months: [{ name: 'Redleaf', days: 30 }, { name: 'Sunwane', days: 31 }], currentYear: 821, currentMonth: 'Sunwane', currentDay: 4 };
    const director = { era: 'AR', months: [{ name: 'Thaw', days: 20 }, { name: 'Sunwane', days: 40 }, { name: 'Ember', days: 25 }] };
    let shared = () => director;
    const suite = fresh();
    let choices = {};
    setActiveCalendarConfig(local);
    setExternalCalendarSource(() => externalCalendar(choices));
    try {
        assert.equal(getActiveCalendarConfig().era, 'CR', 'alone, Delta keeps its own calendar');
        announceNpcStateDelta({ enabled: true, version: '1.2.0' }, suite);
        assert.equal(getActiveCalendarConfig().era, 'CR');
        suite.announce({ id: 'story-director', name: 'Story Director', owns: ['calendar', 'npc'], api: { calendar: () => shared() } });
        const config = getActiveCalendarConfig();
        assert.equal(config.era, 'AR');
        assert.deepEqual(config.months.map(month => `${month.name}:${month.days}`), ['Thaw:20', 'Sunwane:40', 'Ember:25']);
        assert.deepEqual([config.currentYear, config.currentMonth, config.currentDay], [821, 'Sunwane', 4], 'the manual clock is kept when it fits');
        assert.equal(getActiveCalendarConfig(), config, 'an unchanged calendar is reused');
        assert.ok(['Thaw', 'Sunwane', 'Ember'].includes(deterministicCalendarBirthday('Mira Vale', getActiveCalendarConfig()).month), 'generated birthdays use the shared months');

        shared = () => ({ era: 'AR', months: [{ name: 'Thaw', days: 20 }] });
        assert.deepEqual([getActiveCalendarConfig().currentYear, getActiveCalendarConfig().months.length], [null, 1], 'a clock that does not fit is dropped, the shared months stay');

        choices = { calendar: 'mine' };
        assert.equal(getActiveCalendarConfig().era, 'CR', 'This extension keeps Delta\'s calendar');
        choices = {};
        for (const broken of [() => { throw new Error('boom'); }, () => null, () => ({ era: 'AR', months: [] }), () => ({ months: [{ name: 'Thaw', days: 0 }] }), () => 'AR']) {
            shared = broken;
            assert.equal(getActiveCalendarConfig().era, 'CR', 'a throwing, empty or invalid calendar falls back to Delta\'s own');
        }
        suite.announce({ id: 'story-director', name: 'Story Director', owns: ['calendar'] });
        assert.equal(getActiveCalendarConfig().era, 'CR', 'no calendar api, no change');
        suite.withdraw('story-director');
        assert.equal(getActiveCalendarConfig().era, 'CR');
    } finally {
        setExternalCalendarSource(null);
        setActiveCalendarConfig(null);
        delete globalThis.StorySuite;
    }
    assert.equal(getActiveCalendarConfig(), null);
});

test('v1.2.0 the runtime announces itself, follows Enable and defers the scene to Story Block', () => {
    runHostScenario('announce-and-defer', async () => {
        const suite = globalThis.StorySuite;
        const settings = mockState.extensionSettings.storySuite.modules['npc-state-delta'];
        assert.ok(suite, 'the runtime creates the shared registry');
        const own = suite.providers().find(item => item.id === 'npc-state-delta');
        assert.deepEqual(own.owns, ['npc', 'calendar', 'scene', 'stats']);
        assert.equal(own.version, globalThis.NPCStateDelta.version);
        assert.deepEqual(settings.sourceOfTruth, { npc: 'auto', calendar: 'auto', scene: 'auto', stats: 'auto' });
        assert.deepEqual(suite.api('npc-state-delta').npcs(), []);

        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', mood: 'nervous, eager', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun waves nervously from the gate.', swipe_id: 0, swipes: ['Yunyun waves nervously from the gate.'] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await sleep(200);
        assert.deepEqual(suite.api('npc-state-delta').npcs().map(npc => [npc.name, npc.present]), [['Yunyun', true]]);
        const lastPrompt = () => mockState.prompts.filter(args => args[0] === 'story_suite_tail_4_npc_state_delta').at(-1)?.[1] || '';
        assert.match(lastPrompt(), /mood: nervous, eager/, 'alone, the live mood is sent');

        suite.announce({ id: 'story-block', name: 'Story Block', version: '0.8.0', owns: ['scene'] });
        await sleep(10);
        assert.doesNotMatch(lastPrompt(), /mood: nervous/, 'the suite change refreshes the injection');
        assert.match(lastPrompt(), /live mood\/outfit: as in World State/);
        assert.match(lastPrompt(), /Yunyun/);

        const choose = uiHandlers.get('change.npcStateDelta|[data-delta-source-area]');
        choose.call({ dataset: { deltaSourceArea: 'scene' }, value: 'mine' });
        assert.equal(settings.sourceOfTruth.scene, 'mine');
        assert.match(lastPrompt(), /mood: nervous, eager/, 'This extension keeps Delta\'s scene');
        choose.call({ dataset: { deltaSourceArea: 'scene' }, value: 'nonsense' });
        assert.equal(settings.sourceOfTruth.scene, 'auto');

        const enable = uiHandlers.get('change.npcStateDelta|#npc_state_delta_enabled');
        enable.call({ checked: false });
        assert.equal(suite.has('npc-state-delta'), false, 'disable leaves the areas');
        assert.equal(suite.providers().find(item => item.id === 'npc-state-delta')?.enabled, false, 'and stays announced as off');
        enable.call({ checked: true });
        assert.equal(suite.has('npc-state-delta'), true, 'enable announces again');
    });
});

test('v1.2.1 the runtime shares its panel and api.manage, and shows Manage all in Story Suite', () => {
    runHostScenario('overlay-manage', async () => {
        const suite = globalThis.StorySuite;
        const settings = mockState.extensionSettings.storySuite.modules['npc-state-delta'];
        // Record what the runtime writes into its own controls.
        const baseQuery = globalThis.$;
        const writes = [];
        globalThis.$ = selector => {
            const q = baseQuery(selector);
            if (typeof selector !== 'string') return q;
            for (const method of ['prop', 'val']) {
                const original = q[method];
                q[method] = (...args) => { if (args.length) writes.push([selector, method, ...args]); return original.apply(q, args); };
            }
            return q;
        };
        const lastWrite = (selector, method, key) => writes.filter(([s, m, k]) => s === selector && m === method && (key === undefined || k === key)).at(-1);
        const own = () => suite.providers().find(item => item.id === 'npc-state-delta');
        assert.equal(own().settings, '#npc_state_delta_settings', 'the announcement names the settings panel root');
        const manage = own().api.manage;
        assert.deepEqual(manage.areas, ['npc', 'calendar', 'scene', 'stats']);
        assert.deepEqual(manage.sources(), { npc: 'auto', calendar: 'auto', scene: 'auto', stats: 'auto' });
        assert.equal(manage.enabled(), true);

        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', mood: 'nervous, eager', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun waves nervously from the gate.', swipe_id: 0, swipes: ['Yunyun waves nervously from the gate.'] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await sleep(200);
        const lastPrompt = () => mockState.prompts.filter(args => args[0] === 'story_suite_tail_4_npc_state_delta').at(-1)?.[1] || '';
        const alone = lastPrompt();
        assert.match(alone, /mood: nervous, eager/);

        // Story Block arrives with its overlay: the line is shown in the next batched refresh.
        writes.length = 0;
        const opened = [];
        suite.announce({ id: 'story-block', name: 'Story Block', version: '0.9.0', owns: ['scene'], api: { openSuite: tab => opened.push(tab) } });
        assert.equal(lastWrite('#npc_state_delta_suite_manage', 'prop', 'hidden'), undefined, 'refreshed in the onChange microtask, not inline');
        await sleep(10);
        assert.deepEqual(lastWrite('#npc_state_delta_suite_manage', 'prop', 'hidden'), ['#npc_state_delta_suite_manage', 'prop', 'hidden', false]);
        assert.match(lastPrompt(), /live mood\/outfit: as in World State/);
        const click = uiHandlers.get('click.npcStateDelta|[data-delta-open-suite]');
        let prevented = false;
        click({ preventDefault: () => { prevented = true; } });
        assert.deepEqual(opened, ['npc-state-delta']);
        assert.equal(prevented, true);

        // setSource does what the select does, and updates the select.
        assert.equal(manage.setSource('scene', 'mine'), true);
        assert.equal(settings.sourceOfTruth.scene, 'mine');
        assert.deepEqual(manage.sources(), { npc: 'auto', calendar: 'auto', scene: 'mine', stats: 'auto' });
        assert.deepEqual(lastWrite('#npc_state_delta_source_scene', 'val'), ['#npc_state_delta_source_scene', 'val', 'mine']);
        assert.equal(lastPrompt(), alone, 'This extension restores the injection Delta sends alone');
        assert.equal(manage.setSource('scene', 'nonsense'), false);
        assert.equal(manage.setSource('items', 'mine'), false);
        assert.equal(settings.sourceOfTruth.scene, 'mine', 'refused choices change nothing');
        assert.deepEqual(Object.keys(settings.sourceOfTruth), ['npc', 'calendar', 'scene', 'stats']);
        assert.equal(manage.setSource('scene', 'auto'), true);
        assert.match(lastPrompt(), /live mood\/outfit: as in World State/);

        // setEnabled does what the Enable checkbox does, and updates the checkbox.
        manage.setEnabled(false);
        assert.equal(settings.enabled, false);
        assert.deepEqual(lastWrite('#npc_state_delta_enabled', 'prop', 'checked'), ['#npc_state_delta_enabled', 'prop', 'checked', false]);
        assert.equal(own().enabled, false, 'announced as off');
        assert.equal(own().settings, '#npc_state_delta_settings');
        assert.equal(own().api.manage.enabled(), false);
        assert.equal(suite.has('npc-state-delta'), false);
        assert.equal(suite.api('npc-state-delta'), null);
        assert.equal(lastPrompt(), '', 'disabled sends nothing, as from the checkbox');
        await sleep(10);
        assert.deepEqual(lastWrite('#npc_state_delta_suite_manage', 'prop', 'hidden'), ['#npc_state_delta_suite_manage', 'prop', 'hidden', false], 'two announced, on or off');
        const announcements = suite.providers().length;
        manage.setEnabled(false);
        assert.equal(suite.providers().length, announcements);
        own().api.manage.setEnabled(true);
        assert.equal(settings.enabled, true);
        assert.deepEqual(lastWrite('#npc_state_delta_enabled', 'prop', 'checked'), ['#npc_state_delta_enabled', 'prop', 'checked', true]);
        assert.equal(suite.has('npc-state-delta'), true);
        assert.match(lastPrompt(), /live mood\/outfit: as in World State/, 'enabled again, the injection returns');

        // Story Block leaves: the line hides again.
        suite.withdraw('story-block');
        await sleep(10);
        assert.deepEqual(lastWrite('#npc_state_delta_suite_manage', 'prop', 'hidden'), ['#npc_state_delta_suite_manage', 'prop', 'hidden', true]);
        assert.equal(lastPrompt(), alone, 'alone again, the injection is the one Delta sends alone');
        globalThis.$ = baseQuery;
    });
});

test('v1.2.1 the settings panel starts with a hidden Manage all in Story Suite line', () => {
    const index = runtimeSource();
    const html = index.slice(index.indexOf('function buildSettingsHtml()'), index.indexOf('function readOpenSettingsGroups()'));
    assert.match(html, /<div id="\$\{UI_ID\}" class="extension_container[\s\S]*npc-state-delta-drawer story-suite-panel">\s*<div id="npc_state_delta_suite_manage" class="npc-state-delta-suite-manage story-suite-manage" data-story-suite-link hidden>\s*<button type="button" class="menu_button" data-delta-open-suite>[^<]*<i class="fa-solid fa-layer-group"><\/i> Manage all in Story Suite<\/button>\s*<\/div>\s*<div class="delta-settings-quickbar story-suite-quickbar">/);
    assert.match(index, /const UI_ID = 'npc_state_delta_settings';/);
    assert.equal((html.match(/data-story-suite-link/g) || []).length, 1, 'the line carries data-story-suite-link so the overlay can hide it while the panel is inside');
    assert.match(html, /<div [^>]*data-story-suite-link[^>]*>\s*<button [^>]*data-delta-open-suite>/, 'on the element that holds the link');
    const css = styleSource();
    assert.match(css, /\.npc-state-delta-suite-manage\[hidden\] \{ display: none; \}/);
});
