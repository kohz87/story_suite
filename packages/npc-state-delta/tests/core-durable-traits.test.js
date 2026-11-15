import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createNpcRecord,
    mergeScanResult,
    normalizeApparentAge,
    normalizeNpcRecord,
} from '../core.js';

test('existing personality is keep-by-default even if the scanner casually rephrases it', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Shy, approval-seeking, and impulsive when frightened.';
    const result = mergeScanResult({ npcs: [npc], turn: 4 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        personality: 'Quiet, insecure, and somewhat cautious.',
    }] }, { turn: 5 });
    assert.equal(result.state.npcs[0].personality, npc.personality, 'missing evolve decision must preserve established personality');
});

test('explicit grounded personality evolution replaces the durable profile over time', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Shy, approval-seeking, impulsive when frightened, and strongly dependent on her older sister.';
    const result = mergeScanResult({ npcs: [npc], turn: 20 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        personalityState: 'evolve',
        personalityReason: 'After several years living independently, she repeatedly makes difficult decisions without seeking her sister\'s approval.',
        developmentScale: 'explicit',
        developmentReason: 'After several years living independently, she repeatedly makes difficult decisions without seeking her sister\'s approval.',
        personality: 'Reserved but increasingly self-assured; still cautious under pressure, yet willing to trust her own judgment and act independently while remaining deeply attached to her sister.',
    }] }, { turn: 21 });
    assert.match(result.state.npcs[0].personality, /self-assured/i);
    assert.match(result.state.npcs[0].personality, /attached to her sister/i, 'evolution should support continuity rather than erase every core trait');
});

test('personality evolution requires a reason and still respects manual profile locks', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Patient, thoughtful, and slow to anger.';
    const missingReason = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Marris', personalityState: 'evolve', personality: 'Cold and reckless.', present: true,
    }] }, { turn: 2 });
    assert.equal(missingReason.state.npcs[0].personality, npc.personality, 'evolve without grounded reason must be ignored');

    npc.manualProfileFields = ['personality'];
    const locked = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{
        id: npc.id, name: 'Marris', personalityState: 'evolve',
        personalityReason: 'Years of war hardened her outlook.', personality: 'World-weary and severe.', present: true,
    }] }, { turn: 3 });
    assert.equal(locked.state.npcs[0].personality, npc.personality, 'manual Personality lock must remain authoritative');
});

test('manual but unlocked personality can organically refine from newly grounded traits', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Soft-spoken, cautious, and courteous.'; // manually entered baseline, not locked
    npc.manualProfileFields = [];
    const refined = mergeScanResult({ npcs: [npc], turn: 3 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        personalityState: 'refine',
        personality: 'Soft-spoken, cautious, and courteous; dryly humorous with people she trusts.',
    }] }, { turn: 4 });
    assert.match(refined.state.npcs[0].personality, /dryly humorous/i);
    assert.match(refined.state.npcs[0].personality, /cautious/i);
});

test('clearly additive unmarked personality refinement is recovered without allowing casual paraphrase drift', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Soft-spoken, cautious, and courteous.';
    const refined = mergeScanResult({ npcs: [npc], turn: 3 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        personality: 'Soft-spoken, cautious, and courteous, with a dry sense of humor around close friends.',
    }] }, { turn: 4 });
    assert.match(refined.state.npcs[0].personality, /dry sense of humor/i);
});

test('existing appearance is keep-by-default even if the scanner casually rephrases it', () => {
    const npc = createNpcRecord('Selene');
    npc.appearance = 'Tall woman with olive skin, long wavy black hair, amber eyes, and a faint scar beneath her left eye.';
    const result = mergeScanResult({ npcs: [npc], turn: 4 }, { npcs: [{
        id: npc.id, name: 'Selene', present: true,
        appearance: 'Dark-haired woman with striking features.',
    }] }, { turn: 5 });
    assert.equal(result.state.npcs[0].appearance, npc.appearance, 'missing appearance lifecycle decision must preserve established appearance');
});

test('explicit appearance refinement replaces the visual profile with more image-ready detail', () => {
    const npc = createNpcRecord('Selene');
    npc.appearance = 'Young woman with dark hair.';
    const result = mergeScanResult({ npcs: [npc], turn: 8 }, { npcs: [{
        id: npc.id, name: 'Selene', present: true,
        appearanceState: 'refine',
        appearanceReason: 'The scene clearly describes her build, eyes, skin tone, and the old scar on her cheek for the first time.',
        appearance: 'Young woman with a slim build, olive skin, long dark wavy hair, amber eyes, a narrow face, and a faint scar on her left cheek.',
    }] }, { turn: 9 });
    assert.match(result.state.npcs[0].appearance, /olive skin/i);
    assert.match(result.state.npcs[0].appearance, /amber eyes/i);
    assert.match(result.state.npcs[0].appearance, /scar/i);
});

test('appearance changes require a reason and still respect manual profile locks', () => {
    const npc = createNpcRecord('Toris');
    npc.appearance = 'Broad-shouldered man with a thick brown beard and shoulder-length hair.';
    const missingReason = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Toris', appearanceState: 'change', appearance: 'Clean-shaven with cropped hair.', present: true,
    }] }, { turn: 2 });
    assert.equal(missingReason.state.npcs[0].appearance, npc.appearance, 'appearance change without grounded reason must be ignored');

    npc.manualProfileFields = ['appearance'];
    const locked = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{
        id: npc.id, name: 'Toris', appearanceState: 'change',
        appearanceReason: 'Months later he has shaved and cut his hair short.', appearance: 'Broad-shouldered man with cropped hair and a clean-shaven jaw.', present: true,
    }] }, { turn: 3 });
    assert.equal(locked.state.npcs[0].appearance, npc.appearance, 'manual Appearance lock must remain authoritative');
});


test('existing speech is keep-by-default and only grounded durable evolution replaces it', () => {
    const npc = createNpcRecord('Marris');
    npc.speech = 'Soft-spoken, hesitant, and prone to trailing off when challenged.';

    const paraphrase = mergeScanResult({ npcs: [npc], turn: 4 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        speech: 'Quiet and uncertain when speaking.',
    }] }, { turn: 5 });
    assert.equal(paraphrase.state.npcs[0].speech, npc.speech, 'casual speech paraphrase must not rewrite established speech habits');

    const evolved = mergeScanResult(paraphrase.state, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        speechState: 'evolve',
        speechReason: 'After years leading expeditions, she repeatedly speaks in measured direct sentences and gives orders without hedging.',
        developmentScale: 'explicit',
        developmentReason: 'After years leading expeditions, she repeatedly speaks in measured direct sentences and gives orders without hedging.',
        speech: 'Measured and direct, with deliberate pauses; gives concise instructions without her former hesitant trailing-off.',
    }] }, { turn: 6 });
    assert.match(evolved.state.npcs[0].speech, /Measured and direct/i);
    assert.match(evolved.state.npcs[0].speech, /former hesitant/i);
});

test('speech evolution requires a reason and respects manual profile locks', () => {
    const npc = createNpcRecord('Marris');
    npc.speech = 'Formal and careful with strangers.';
    const missingReason = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true, speechState: 'evolve', speech: 'Blunt and casual.',
    }] }, { turn: 2 });
    assert.equal(missingReason.state.npcs[0].speech, npc.speech);

    npc.manualProfileFields = ['speech'];
    const locked = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true, speechState: 'evolve',
        speechReason: 'Years among soldiers changed her habitual register.', speech: 'Blunt and colloquial.',
    }] }, { turn: 3 });
    assert.equal(locked.state.npcs[0].speech, npc.speech, 'manual Speech lock must remain authoritative');
});

test('manual but unlocked speech can refine as recurring speech habits become established', () => {
    const npc = createNpcRecord('Marris');
    npc.speech = 'Soft and formal.';
    npc.manualProfileFields = [];
    const refined = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true, speechState: 'refine',
        speech: 'Soft and formal; uses proper titles, careful requests, and rarely gives direct commands.',
    }] }, { turn: 3 });
    assert.match(refined.state.npcs[0].speech, /proper titles/i);
    assert.match(refined.state.npcs[0].speech, /Soft and formal/i);
});

test('mannerisms are keep-by-default and grounded evolution replaces the current set instead of appending history', () => {
    const npc = createNpcRecord('Marris');
    npc.mannerisms = ['Avoids eye contact when challenged.', 'Twists her sleeves when nervous.'];

    const casual = mergeScanResult({ npcs: [npc], turn: 4 }, { npcs: [{
        id: npc.id, name: 'Marris', present: true, mannerisms: ['Taps the table while thinking.'],
    }] }, { turn: 5 });
    assert.deepEqual(casual.state.npcs[0].mannerisms, npc.mannerisms, 'unmarked mannerisms must not accumulate forever');

    const evolved = mergeScanResult(casual.state, { npcs: [{
        id: npc.id, name: 'Marris', present: true,
        mannerismState: 'evolve',
        mannerismReason: 'Her long-established confidence is now shown repeatedly through steady eye contact, while one old anxiety tell remains.',
        developmentScale: 'explicit',
        developmentReason: 'Her long-established confidence is now shown repeatedly through steady eye contact, while one old anxiety tell remains.',
        mannerisms: ['Holds steady eye contact when making decisions.', 'Rubs her thumb over her knuckles when deeply anxious.'],
    }] }, { turn: 6 });
    assert.deepEqual(evolved.state.npcs[0].mannerisms, [
        'Holds steady eye contact when making decisions.',
        'Rubs her thumb over her knuckles when deeply anxious.',
    ]);
    assert.ok(!evolved.state.npcs[0].mannerisms.some(item => /Twists her sleeves/i.test(item)), 'obsolete mannerisms should retire instead of lingering');
});

test('unlocked mannerism refine accepts a full current set instead of retaining omitted old habits', () => {
    const npc = createNpcRecord('Toris');
    npc.mannerisms = ['Scratches his beard before answering.'];
    const refined = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, present: true, mannerismState: 'refine',
        mannerisms: ['Habitually squares his shoulders before delivering bad news.'],
    }] }, { turn: 2 });
    assert.deepEqual(refined.state.npcs[0].mannerisms, [
        'Habitually squares his shoulders before delivering bad news.',
    ]);
});

test('mannerism evolution requires grounded evidence and respects manual profile locks', () => {
    const npc = createNpcRecord('Toris');
    npc.mannerisms = ['Scratches his beard before answering.'];
    const missingReason = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, present: true, mannerismState: 'evolve', mannerisms: ['Folds his arms while listening.'],
    }] }, { turn: 2 });
    assert.deepEqual(missingReason.state.npcs[0].mannerisms, npc.mannerisms);

    npc.manualProfileFields = ['mannerisms'];
    const locked = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{
        id: npc.id, present: true, mannerismState: 'evolve', mannerismReason: 'The habit changed after he shaved.',
        mannerisms: ['Rubs his jaw before answering.'],
    }] }, { turn: 3 });
    assert.deepEqual(locked.state.npcs[0].mannerisms, npc.mannerisms);
});

test('manual stable profile fields are protected while dynamic state and relationship deltas still evolve', () => {
    const npc = createNpcRecord('Yunyun');
    npc.age = '19';
    npc.appearance = 'User-authored detailed visual profile';
    npc.personality = 'User-authored personality';
    npc.speech = 'User-authored speech';
    npc.mannerisms = ['user-authored habit'];
    npc.manualProfileFields = ['age', 'appearance', 'personality', 'speech', 'mannerisms'];
    const result = mergeScanResult({ npcs: [npc], turn: 3 }, { npcs: [{
        id: npc.id, name: 'Yunyun', present: true, age: '25', appearance: 'scanner visual rewrite', personality: 'scanner rewrite', speech: 'scanner rewrite', mannerisms: ['scanner habit'], mood: 'flustered', relationshipImpact: 'ordinary', relationshipDelta: { trust: 4 }, relationshipEvidence: { trust: 'Yunyun relied on the player and found them dependable.', affection: '', desire: '', tension: '' }, relationshipChangeReason: 'Yunyun relied on the player during the current exchange.',
    }] }, { maxNpcs: 40, turn: 4 });
    const updated = result.state.npcs[0];
    assert.equal(updated.age, '19');
    assert.equal(updated.appearance, 'User-authored detailed visual profile');
    assert.equal(updated.personality, 'User-authored personality');
    assert.equal(updated.speech, 'User-authored speech');
    assert.deepEqual(updated.mannerisms, ['user-authored habit']);
    assert.equal(updated.mood, 'flustered', 'dynamic fields should remain scanner-driven');
    assert.equal(updated.relationship.trust, 1, 'relationship deltas continue from manual/current values but ordinary progression is intentionally slow');
});

test('v0.2.8 apparent-age canon normalizes word numbers and decade prose to stable ~N', () => {
    assert.equal(normalizeApparentAge('around six', 'Liza'), '~6');
    assert.equal(normalizeApparentAge('about six', 'Liza'), '~6');
    assert.equal(normalizeApparentAge('six years old', 'Liza'), '~6');
    const twenties = normalizeApparentAge('Twenties', 'Brina Hael');
    assert.match(twenties, /^~2\d$/);
    assert.equal(normalizeApparentAge('around twenties', 'Brina Hael'), twenties, 'equivalent decade prose must keep the same seeded estimate');
    assert.match(normalizeApparentAge('early twenties', 'Brina Hael'), /^~2[0-3]$/);
    assert.match(normalizeApparentAge('mid thirties', 'Brina Hael'), /^~3[4-6]$/);
    assert.match(normalizeApparentAge('late thirties', 'Brina Hael'), /^~3[7-9]$/);
    assert.equal(normalizeApparentAge('around nonsense', 'Brina Hael'), '', 'unknown prose must not leak into the compact field');
});

test('v0.2.8 Appearance removes redundant explicit age while Apparent Age stays authoritative', () => {
    const npc = normalizeNpcRecord({
        name: 'Liza Hael',
        apparentAge: 'around six',
        appearance: 'A five-year-old human girl with shoulder-length brown curls, brown eyes, and a small build.',
    });
    assert.equal(npc.apparentAge, '~6');
    assert.equal(npc.appearance, 'A human girl with shoulder-length brown curls, brown eyes, and a small build.');
    assert.doesNotMatch(npc.appearance, /five-year-old|\bage\s*6\b/i);
});

test('v0.2.8 Noctis-style paperwork gestures compact into one mannerism pattern', () => {
    const npc = normalizeNpcRecord({
        name: 'Maren Rost',
        mannerisms: [
            'Thrusts quills and parchment at people.',
            'Slaps contract notices onto counters.',
            'Flicks seal-stamps across desks.',
        ],
    });
    assert.deepEqual(npc.mannerisms, ['Handles paperwork with brisk, emphatic physical gestures.']);
});
