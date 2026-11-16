import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createNpcRecord,
    normalizeNpcRecord,
    buildNpcPortraitPrompts,
    normalizePortraitPromptFormat,
    normalizePortraitSeed,
} from '../../modules/people/core/core.js';

test('portrait prompt builder uses visual dossier fields and excludes nonvisual profile prose', () => {
    const prompts = buildNpcPortraitPrompts({
        name: 'Astra',
        species: 'Silver dragon',
        age: '143',
        apparentAge: '36',
        role: 'Vice Commander',
        appearance: 'Adult woman with hip-length silver hair, amber slit-pupil eyes, swept silver horns, crystalline wings, and a dark officer coat.',
        mood: 'calm and affectionate',
        location: 'Great Kitchen Hall',
        personality: 'Vulnerable, maternal, fiercely loyal.',
        background: 'Raised beyond the northern marches.',
        memories: ['Lucien rescued her during the winter siege.'],
        relationshipSummary: 'Deeply bonded to Lucien.',
    }, {
        stylePositive: 'anime key visual, clean linework',
        styleNegative: 'blurry, watermark',
        composition: 'solo upper-body portrait, face visible',
        format: 'hybrid',
        useMood: true,
        useLocation: false,
    });

    assert.match(prompts.positive, /anime key visual/i);
    assert.match(prompts.positive, /Silver dragon/);
    assert.match(prompts.positive, /apparent age 36/i);
    assert.match(prompts.positive, /Vice Commander/);
    assert.match(prompts.positive, /hip-length silver hair/);
    assert.match(prompts.positive, /calm and affectionate/);
    assert.match(prompts.positive, /solo upper-body portrait/);
    assert.doesNotMatch(prompts.positive, /Great Kitchen Hall/);
    assert.doesNotMatch(prompts.positive, /Vulnerable, maternal/);
    assert.doesNotMatch(prompts.positive, /northern marches/);
    assert.doesNotMatch(prompts.positive, /winter siege/);
    assert.doesNotMatch(prompts.positive, /Deeply bonded/);
    assert.match(prompts.negative, /blurry, watermark/);
    assert.match(prompts.negative, /blonde hair/);
    assert.doesNotMatch(prompts.negative, /silver hair/);
});

test('portrait prompt builder supports optional location, per-NPC overrides, and replacement mode', () => {
    const npc = {
        species: 'Half-elf', apparentAge: '~24', role: 'Knight', appearance: 'Long white hair and grey eyes.',
        mood: 'wary', location: 'Moonlit courtyard',
        portraitPromptPositive: 'black ceremonial ribbon',
        portraitPromptNegative: 'helmet, hood',
    };
    const normal = buildNpcPortraitPrompts(npc, {
        stylePositive: 'fantasy anime', styleNegative: 'low quality', composition: 'portrait',
        useMood: false, useLocation: true, format: 'tags',
    });
    assert.match(normal.positive, /fantasy anime/);
    assert.match(normal.positive, /Moonlit courtyard/);
    assert.match(normal.positive, /black ceremonial ribbon/);
    assert.doesNotMatch(normal.positive, /wary/);
    assert.match(normal.negative, /low quality/);
    assert.match(normal.negative, /helmet, hood/);
    assert.match(normal.negative, /blonde hair/);
    assert.doesNotMatch(normal.negative, /^white hair(?:,|$)/i);

    const replaced = buildNpcPortraitPrompts({ ...npc, portraitPromptReplace: true }, {
        stylePositive: 'ignored style', styleNegative: 'low quality', composition: 'ignored composition',
        format: 'natural', useMood: true, useLocation: true,
    });
    assert.equal(replaced.positive, 'black ceremonial ribbon');
    assert.equal(replaced.negative, 'low quality, helmet, hood');
    assert.equal(replaced.replaceAutomatic, true);
});

test('portrait prompt builder preserves long style, composition, and per-NPC prompt text beyond the former caps', () => {
    const stylePositive = `${'polished fantasy anime detail, '.repeat(220)}POSITIVE_STYLE_SENTINEL`;
    const styleNegative = `${'negative exclusion detail, '.repeat(180)}NEGATIVE_STYLE_SENTINEL`;
    const composition = `${'portrait composition instruction, '.repeat(70)}COMPOSITION_SENTINEL`;
    const extraPositive = `${'character-specific positive detail, '.repeat(110)}EXTRA_POSITIVE_SENTINEL`;
    const extraNegative = `${'character-specific negative detail, '.repeat(110)}EXTRA_NEGATIVE_SENTINEL`;
    const prompts = buildNpcPortraitPrompts({
        species: 'Half-elf',
        apparentAge: '~12',
        appearance: 'Amber-gold and deep-indigo hair, bright electric-gold eyes, long pointed ears.',
        portraitPromptPositive: extraPositive,
        portraitPromptNegative: extraNegative,
    }, {
        stylePositive,
        styleNegative,
        composition,
        format: 'hybrid',
    });

    assert.ok(prompts.positive.length > 6000, 'assembled positive prompt should exceed the former 6000-character cap without truncation');
    assert.ok(prompts.negative.length > 4000, 'assembled negative prompt should exceed the former 4000-character cap without truncation');
    assert.match(prompts.positive, /POSITIVE_STYLE_SENTINEL/);
    assert.match(prompts.positive, /COMPOSITION_SENTINEL/);
    assert.match(prompts.positive, /EXTRA_POSITIVE_SENTINEL/);
    assert.match(prompts.negative, /NEGATIVE_STYLE_SENTINEL/);
    assert.match(prompts.negative, /EXTRA_NEGATIVE_SENTINEL/);

    const normalized = normalizeNpcRecord({
        name: 'Sora',
        portraitPromptPositive: `${'override positive, '.repeat(180)}NORMALIZED_POSITIVE_SENTINEL`,
        portraitPromptNegative: `${'override negative, '.repeat(180)}NORMALIZED_NEGATIVE_SENTINEL`,
    });
    assert.match(normalized.portraitPromptPositive, /NORMALIZED_POSITIVE_SENTINEL/);
    assert.match(normalized.portraitPromptNegative, /NORMALIZED_NEGATIVE_SENTINEL/);
});

test('portrait seed normalization is optional, bounded, and integer-only', () => {
    assert.equal(normalizePortraitSeed(null), null);
    assert.equal(normalizePortraitSeed(''), null);
    assert.equal(normalizePortraitSeed('123456789'), 123456789);
    assert.equal(normalizePortraitSeed(0), 0);
    assert.equal(normalizePortraitSeed(-1), null);
    assert.equal(normalizePortraitSeed(1.5), null);
    assert.equal(normalizePortraitSeed(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
    assert.equal(normalizePortraitSeed(Number.MAX_SAFE_INTEGER + 1), null);

    const npc = normalizeNpcRecord({ name: 'Seeded', portraitSeed: '424242' });
    assert.equal(npc.portraitSeed, 424242);
    assert.equal(createNpcRecord('Unseeded').portraitSeed, null);
});

test('portrait prompt format normalization is conservative', () => {
    assert.equal(normalizePortraitPromptFormat('tags'), 'tags');
    assert.equal(normalizePortraitPromptFormat('natural'), 'natural');
    assert.equal(normalizePortraitPromptFormat('hybrid'), 'hybrid');
    assert.equal(normalizePortraitPromptFormat('unknown-model-format'), 'hybrid');
});
