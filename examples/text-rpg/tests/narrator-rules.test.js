// The `rules` setting: the reader's own narrator rules replace the built-in rules paragraph only; empty gives the built-in text; the grammar lines stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATIC_TEXT, narratorRules } from '../src/module-parts/static-text.js';
import { SETTINGS } from '../src/module-parts/settings.js';
import { withAstra, sent, reply } from './helpers/host.js';

test('narratorRules: the built-in text unless the setting has text once trimmed', () => {
    for (const none of [undefined, {}, { rules: '' }, { rules: '  \n ' }, { rules: 5 }]) assert.equal(narratorRules(none), STATIC_TEXT);
    assert.equal(narratorRules({ rules: '  Be brief.\n' }), 'Be brief.');
});

test('the rules setting is a prompt-form text of at most 2,500 characters, default empty', () => {
    assert.equal(SETTINGS.defaults.rules, '');
    assert.deepEqual([SETTINGS.schema.rules.type, SETTINGS.schema.rules.form, SETTINGS.schema.rules.max], ['text', 'prompt', 2500]);
    assert.equal(SETTINGS.schema.rules.label, 'Text RPG: Narrator rules');
    assert.equal(SETTINGS.schema.rules.builtin, STATIC_TEXT);
    assert.ok(STATIC_TEXT.length <= 2500);
});

test('on the host: own rules replace only the rules paragraph; the grammar lines stay; empty gives the built-in text back', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('One.', reply('A.'));
        const [builtIn] = sent(host, 'story_suite_static');
        assert.ok(builtIn.includes(STATIC_TEXT));
        assert.equal(host.settings.set('text-rpg', 'rules', 'Narrate short.\nAlways ask for ? try when it matters.'), 'Narrate short.\nAlways ask for ? try when it matters.');
        await host.send('Two.', reply('B.'));
        const own = sent(host, 'story_suite_static').at(-1);
        assert.ok(own.includes('Narrate short.\nAlways ask for ? try when it matters.'));
        assert.ok(!own.includes('Never write numbers, dice or luck.'));
        assert.match(own, /^\? try Who \| skill or stat \| trivial\|easy\|ordinary\|hard\|very hard\|near impossible/m);
        assert.equal(own.replace('Narrate short.\nAlways ask for ? try when it matters.', STATIC_TEXT), builtIn);
        host.settings.set('text-rpg', 'rules', '');
        await host.send('Three.', reply('C.'));
        assert.equal(sent(host, 'story_suite_static').at(-1), builtIn);
        assert.equal(host.settings.set('text-rpg', 'rules', 'x'.repeat(3000)).length, 2500, 'a longer text is cut at 2,500 by the store');
    } finally {
        host.close();
    }
});

test('the built-in rules are the owner\'s dice rules in short (at most 420 words) and carry each of their points', () => {
    assert.ok(STATIC_TEXT.split(/\s+/).length <= 420, 'short: at most 420 words');
    for (const part of [
        'Roll only when an attempt is possible but uncertain', 'never roll routine things, thoughts, feelings, decisions or background', 'One objective, one roll, one skill',
        'never exceeds the character\'s capability or creates a place', 'Searching, tracking and navigating may be rolled', 'Use dice in order, skipping the die of a moot action',
        'Name the foe group with against: when several stand; an edge needs a reason', 'A natural 20 or 1 changes only how it is told', 'Costs and failures come only from risks in the scene',
        'Failure is a scene, not a wall: its cost stands and the situation changes; no rescue or reset in the same beat; a retry is new', 'the matchup line, who should win', 'Dice tip a close fight, never rescue a lost one',
        'an outmatched side wins only through an edge set up before', 'Defeat, capture and retreat are ordinary', 'Foes fight to their strength (flank, focus the wounded, press an advantage) and most want to live',
        'no lucky openings or rescues not set up', 'When unsure, take the harsher outcome', 'Badly wounded cannot fight on effectively; Down cannot act',
        'Set the foes with + foes before a fight', 'add none mid-fight except declared reinforcements', '+ xp only for foes that fell this reply; end foes that fled or were left with - foes',
        'each with its kind', 'vermin: rats', 'common: bandit, wolf', 'trained: soldier', 'elite: troll', 'monster: wyvern', 'legend: dragon',
        'Every reward must point to something shown on screen this reply', 'Never write numbers, dice or luck.',
    ]) assert.ok(STATIC_TEXT.includes(part), part);
    assert.doesNotMatch(STATIC_TEXT, /plot armour/i);
});

test('a repeated move on one group is one roll for the run, and a chain of separate fights stops as the next one begins', () => {
    assert.match(STATIC_TEXT, /one move repeated on one group \(picking them off one by one\) is one roll for the whole run/);
    assert.match(STATIC_TEXT, /chains separate fights, play the first and the safe steps after it, then stop as the next fight begins/);
});

test('after a failure its cost stands, then the reader\'s plan carries on from there if it still makes sense (their own fallback first), else the reply stops', () => {
    assert.match(STATIC_TEXT, /Then carry on with the reader's plan if it still makes sense \(their own fallback first\), else stop\./);
});
