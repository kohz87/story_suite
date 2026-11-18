import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createNpcRecord, mergeScanResult, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { APPEARANCE_MODEL_VERSION, applyAppearanceUpdate, normalizeAppearanceModel, resolveNpcAppearance } from '../../modules/people/appearance/appearance.js';
import { buildScannerPrompt } from '../../modules/people/core/continuity-core.js';


const BODY = 'Tall and slender, long silver hair, violet eyes';

test('1: a scan that sends the body as Physical features writes it into outfit-only forms', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 1 }, { npcs: [{
        name: 'Noela', role: 'dragon', overallAppearance: BODY, present: true, dossierSignal: 'persistent', currentForm: 'Dragon',
        appearanceForms: [{ name: 'Human', appearance: 'Wearing a grey cloak' }, { name: 'Dragon', appearance: 'A forty-foot silver dragon with pearl-white scales' }],
    }] }, { turn: 1, sourceMessageId: 1, developmentContext: 'Noela, tall and slender with long silver hair and violet eyes, wears a grey cloak. She becomes a forty-foot silver dragon with pearl-white scales.' });
    const forms = Object.fromEntries(result.state.npcs[0].appearanceForms.map(form => [form.name, form.appearance]));
    assert.equal(forms.Human, `${BODY}; Wearing a grey cloak`);
    assert.equal(forms.Dragon, 'A forty-foot silver dragon with pearl-white scales', 'a form that describes its own body is left alone');
    // An existing NPC gaining a new outfit-only form in a scan that also gives the body.
    const npc = normalizeAppearanceModel({ appearanceModelVersion: APPEARANCE_MODEL_VERSION, appearanceForms: [{ name: 'Dragon', appearance: 'A silver dragon' }], currentForm: 'Dragon' });
    const added = applyAppearanceUpdate(npc, { overallAppearance: BODY, appearanceForms: [{ name: 'Human', appearance: 'Wearing a grey cloak' }] });
    assert.equal(added.appearanceForms.find(form => form.name === 'Human').appearance, `${BODY}; Wearing a grey cloak`);
    assert.equal(added.appearanceForms.find(form => form.name === 'Dragon').appearance, 'A silver dragon');
});

test('2: the general Appearance rule no longer contradicts complete forms', () => {
    const prompt = buildScannerPrompt({ transcript: 'Noela shifts into her dragon form.', existingNpcs: [normalizeNpcRecord({ name: 'Noela', appearanceModelVersion: APPEARANCE_MODEL_VERSION, appearanceForms: [{ name: 'Dragon', appearance: 'A silver dragon' }], currentForm: 'Dragon' })] });
    assert.match(prompt, /overallAppearance \(no named forms\)=readable: kind/);
    assert.doesNotMatch(prompt, /overallAppearance=readable/);
});

test('3: an unknown transformed form of an NPC with named forms gets no human body', () => {
    const base = { overallAppearance: BODY, appearanceForms: [{ name: 'Human', appearance: `${BODY}; grey cloak` }], currentFormUnknown: true, unclassifiedAppearance: 'A huge shadowy wolf with glowing eyes' };
    assert.equal(resolveNpcAppearance({ ...base, appearanceModelVersion: APPEARANCE_MODEL_VERSION }), 'A huge shadowy wolf with glowing eyes');
    assert.equal(resolveNpcAppearance({ ...base, appearanceModelVersion: 1 }), `${BODY}; A huge shadowy wolf with glowing eyes`, 'a version-1 record keeps what it showed');
    assert.equal(resolveNpcAppearance({ overallAppearance: BODY, currentFormUnknown: true, unclassifiedAppearance: 'Wreathed in mist' }), `${BODY}; Wreathed in mist`, 'without named forms Physical features still apply');
});

test('7/8: unused Physical features do not reject a portrait, and other forms are bounded in scan context', () => {
    const portrait = fs.readFileSync(new URL('../../modules/people/portrait/portrait-tools.js', import.meta.url), 'utf8');
    assert.match(portrait, /formsInUse \? '' : \(npc\.overallAppearance \|\| ''\)/);
    const long = `${'A towering silver dragon with pearl-white scales, '.repeat(12)}and vast wings`;
    const npc = normalizeNpcRecord({ name: 'Noela', present: true, appearanceModelVersion: APPEARANCE_MODEL_VERSION, currentForm: 'Human',
        appearanceForms: [{ name: 'Human', appearance: `${BODY}; grey cloak` }, { name: 'Dragon', appearance: long }] });
    const prompt = buildScannerPrompt({ transcript: 'Noela shifts into her dragon form.', existingNpcs: [npc] });
    const context = prompt.slice(prompt.indexOf('Established Stage 4 appearance forms'));
    assert.match(context, new RegExp(`${BODY}; grey cloak`), 'the current form is shown whole');
    assert.ok(!context.includes(long), 'another form is shortened');
    assert.match(context, /…"/);
});

test('11/12: dead code is gone', () => {
    const sources = JSON.parse(fs.readFileSync(new URL('../../modules/people/runtime/runtime-modules.json', import.meta.url), 'utf8')).modules
        .map(module => fs.readFileSync(new URL(`../${module.path}`, import.meta.url), 'utf8')).join('\n');
    for (const name of ['hostIsOlderPrefix', 'portraitCustomPresetOptionsHtml', 'mergeMannerismRefinements', 'behaviorAgencyPolarity', 'safeUnmarkedReplacement',
        'boundRootSnapshot', 'queueSettingsSave', 'destructiveSettlementStatus', 'calendarSettingsSnapshot', 'estimateLocalTokens', 'portraitSignature']) {
        assert.doesNotMatch(sources, new RegExp(`\\b${name}\\b`), name);
    }
});
