// The RPG's lean prompt (prompt diet step 2, 3 Nov): a numbered family of kinds is one template line, the health words are told once, the Standard
// blocks' descriptions are shorter, and the combat text, the Foes grammar and the party line are told only while a fight is open or when
// rolls were made for this reply. Text only: every kind is still declared and every line is read as before, so a fight the narrator opens without a
// plan parses, and the same reply rebuilt (a swipe that keeps its plan) tells the same prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../testkit/index.js';
import { createFakeModel } from '../../../testkit/model.js';
import { LEAN_RPG_FEATURE, readSheet } from '../../../modules/rpg/index.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../modules/rpg/templates.js';
import { moduleGrammar } from '../../../modules/data-modules/grammar.js';
import { reply, success } from '../data-modules/helpers.js';
import { CORE_FEATURE } from '../../../core/features.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
// The Standard blocks' text before this change: what a chat that pinned them then still holds.
const BEFORE = {
    character: "One character: who they are, health, stamina and mana (words, shown as bars of blocks that grow with VIT, AGI and INT), seven stats from 1 to 20, unspent points, Level 1 to 99 and XP to 100. The narrator sets health, mana, stamina and XP by words; the story cannot kill a character outright: they die only when they were already Down before a reply and are still Down at its end. The reader sets stats and points. XP at 100 raises the Level by one, up to the Level cap, and every third Level gives a point to spend on stats.",
    skills: "Up to five skills for one character. Each has a description, the stat it rolls with, what it uses (stamina or mana), a rank (Novice, Adept, Expert, Master) and practice from 0 to 100. The narrator names a skill with a learn line (name, what it does, stat, uses) and adds practice. At 100 practice the rank rises by one and practice starts again at 0; a Master stays at 100.",
    foes: "Up to four foe groups in the current fight. A group is one slot: its name, how many it has (count 0 means the slot is empty), its level from 1 to 99 and its health (words: a group of a higher level has more blocks of health). The narrator sets a slot when a group arrives, hurts it as the fight goes and clears it when the group is down, gone, fled, captured or has yielded.",
    rules: "[COMBAT SYSTEM]\nNo Plot Armor: combat follows physical reality and the lore. Size, skill, numbers, reach, armor, terrain, preparation and Level all matter. Against a stronger foe, {{user}} loses unless a believable edge exists: ambush, terrain, numbers, poison, preparation.\nExchanges: a fight is told exchange by exchange, each with clear cause, cost and consequence, in the order things happen. Most fights are short; never skip the moment that decides it.\nWeight & Risk: every strike, miss, wound and hesitation carries impact. Injury, fatigue, fear and pain carry into the next exchange and the next scene.\nBelievable Outcomes: fights end when logic demands it: death, surrender, retreat, capture or collapse. Victory must be earned; survival must be justified.\nRolls: attacks, spells, defence, talk and checks each pair a main stat with half of a second one. Health, stamina and mana are rows of blocks: a hit takes one, a Decisive hit two, and a foe of a higher Level has more. Tell the rolled result; code moves the bars for hits, heals, skill costs: never set those.\nXP guide: code gives XP for a won fight; write none for it. Other deeds 5 to 40. Code practises rolled skills.",
};
const staticOf = request => request.chat[0].content;
const definitionOf = (templates, role) => templates.find(entry => entry.definition.role === role).definition;
const fieldsOf = (host, slug = 'foes') => host.head().domains.dataModules.instances[`pack.chat/${slug}`].chat.fields;
const FOES = (n, extra = ' | name: Silt Hound | count: 2 | level: 5') => `+ dm foes — a pack attacks | kind: set-slot-${n}${extra}`;

async function world(t, { answers = [], templates = STANDARD_TEMPLATES, settings = null, rpg = true } = {}) {
    const model = createFakeModel(answers);
    const host = await createHost({ callModel: model, ...(settings ? { settings } : {}) });
    t.after(() => host.close());
    host.features.set(LEAN_RPG_FEATURE, rpg);
    host.features.set(CORE_FEATURE.fightBoard, false);
    await host.send('Begin.', 'Opening.');
    for (const entry of templates) success(await host.sdk.command('dm.define', { definition: structuredClone(entry.definition) }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Wessel', level: 15 } }));
    return { host, model };
}

test('a family needs three kinds numbered from 1; fewer, or a gap, are written kind by kind', () => {
    const labels = { amount: { type: 'int', min: 1, max: 9 } };
    const kind = { op: '+', labels, when: true, effects: [] };
    const make = names => ({ scope: 'chat', kinds: Object.fromEntries(names.map(name => [name, kind])), state: {} });
    assert.match(moduleGrammar(make(['tier-1', 'tier-2']), 'tiers'), /kind: tier-1[^]*kind: tier-2/u);
    assert.match(moduleGrammar(make(['tier-1', 'tier-3', 'tier-4']), 'tiers'), /kind: tier-1[^]*kind: tier-3[^]*kind: tier-4/u);
    const three = moduleGrammar(make(['tier-1', 'tier-2', 'tier-3']), 'tiers');
    assert.match(three, /kind: tier-N \| amount: 1\.\.9/u);
    assert.match(three, /N = 1\.\.3 for tier-N\./u);
    // Labels that differ keep a kind out of the family.
    const odd = make(['tier-1', 'tier-2', 'tier-3']);
    odd.kinds['tier-3'] = { ...kind, labels: { amount: { type: 'int', min: 1, max: 5 } } };
    assert.match(moduleGrammar(odd, 'tiers'), /kind: tier-1[^]*kind: tier-2[^]*kind: tier-3/u);
});

test('"same words as" names only a line that is in the prompt: a first line the budget cuts leaves the words to the next module', () => {
    const mood = { type: 'enum', values: ['calm and quiet', 'tense and watchful', 'angry and loud', 'afraid and small'] };
    const kind = labels => ({ op: '+', labels, when: true, effects: [] });
    const filler = Object.fromEntries(Array.from({ length: 60 }, (_, n) => [`filler${String.fromCharCode(97 + (n % 26))}${String.fromCharCode(97 + Math.floor(n / 26))}`, kind({ x: { type: 'enum', values: ['a', 'b'] } })]));
    const first = { scope: 'chat', kinds: { ...filler, mood: kind({ mood }) }, state: {} };
    const second = { scope: 'chat', kinds: { mood: kind({ mood }) }, state: {} };
    const seen = new Map();
    const cut = moduleGrammar(first, 'first', { seen });
    assert.doesNotMatch(cut, /kind: mood/u, 'the budget cut the mood line');
    assert.match(moduleGrammar(second, 'second', { seen }), /mood: calm and quiet\|tense and watchful\|angry and loud\|afraid and small$/u, 'the words in full');
    // A first line that is in the prompt is still referred to.
    const kept = new Map();
    moduleGrammar({ scope: 'chat', kinds: { mood: kind({ mood }) }, state: {} }, 'first', { seen: kept });
    assert.match(moduleGrammar(second, 'second', { seen: kept }), /mood: same words as first mood/u);
});
