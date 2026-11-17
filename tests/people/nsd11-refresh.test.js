// N8 (NPC State NSD11): Refresh writes the slow fields; it reads the stored tastes and ties, returns no tastes, and runs rolling (each person waits 4 replies, one person per reply; tests/people/catchup-rolling.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildProfileRefreshPrompt, returnShape } from '../../modules/people/core/core-mechanics.js';
import { storedReads } from '../../modules/people/core/core-prompts-targeted-parts/stored-reads.js';
import { mergeScanResult, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { fillFailureNote } from '../../modules/people/meters/npc-lines-parts/fill-in.js';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const target = { id: 'myla', name: 'Myla Venn', role: 'clerk' };
const prompt = (extra = {}) => buildProfileRefreshPrompt({ transcript: '[m1] Myla sets down the ledger.', targetNpc: target, ...extra });

test('the Refresh return shape is only changed fields: no keep states, no mood numbers, no tastes, no edges', () => {
    const shape = returnShape('refresh', { id: '"<target id>"', name: '"<target name>"' });
    assert.doesNotMatch(shape, /keep|moodV|moodA|moodD|tastes|keyRelationshipEdges/);
    assert.match(shape, /^Return shape \(JSON; key=text, \[\]=list, a\|b=one of; only changed fields; a \*State goes with its \*Reason\):/);
    assert.match(shape, /gender:male\|female,genderState:correct,homeBase,homeBaseState:update,age,ageState:advance\|correct/);
    assert.match(shape, /mood,moodState:clear,location,locationState:clear,goal,goalState:clear,status,statusState:clear,lifeState:alive\|deceased,lifeStateCertainty:explicit,lifeStateReason,memories:\[\],memoryRetention:\[\]\}\]/);
    assert.match(shape, /evidence:\{field:\["\[mN\] short quote"\]\}/);
    assert.match(shape, /overallAppearance,overallAppearanceState:refine\|change/);
    assert.match(shape, /currentForm,currentFormState:select\|unknown/);
    assert.match(returnShape('backfill'), /genderState:keep\|correct/, 'backfill and import keep their shape');
    assert.match(returnShape('backfill'), /moodV:-3\.\.3/);
});

test('the Refresh text is the approved NSD11 text with the slow-field quote rule (rule 3, owner OK pending)', () => {
    const text = prompt();
    assert.match(text, /^NPC State Delta TARGETED REFRESH FROM CHAT\. .* You are the only writer of the slow fields \(personality, speech, behaviorProfile, mannerisms, background, home base, key relationships, relationship summary\): the story replies no longer write them\. Read the whole window\./);
    assert.match(text, /\n3\. QUOTES: for personality, speech, behaviorProfile, mannerisms and background, put the few words of the story that show it, with its \[mN\], in profileUpdates\.evidence under that field's name \(background too\)\./);
    assert.match(text, /\n4\. SLOW FIELDS NEED MORE THAN ONE MOMENT: .* two or more \[mN\] or the story states it outright\./);
    assert.match(text, /\n14\. TASTES AND TIES ARE READ-ONLY here\..* never return tastes\./);
    assert.match(text, /\n15\. Compact, caps: .*\. JSON only; omit unchanged fields\.\n/);
    assert.doesNotMatch(text, /deliberate user action/);
});

test('the dossier JSON gains the stored tastes and ties only when there are some', () => {
    assert.doesNotMatch(prompt(), /"tastes":|"ties":/);
    const reads = storedReads({ tastes: [{ sign: '+', item: 'tea' }, { sign: '-', item: 'loud bells' }], ties: [{ name: 'Oren', tags: ['owes'], owedBy: false }] });
    assert.deepEqual(reads, { tastes: 'likes: tea; dislikes: loud bells', ties: ['with Oren: owes'] });
    const text = prompt({ storedReads: reads });
    assert.match(text, /"tastes":"likes: tea; dislikes: loud bells","ties":\["with Oren: owes"\]\}/);
    assert.equal(storedReads(null), null);
    assert.equal(storedReads({ tastes: Array.from({ length: 20 }, (_, i) => ({ sign: '+', item: `t${i}` })) }).tastes.split(', ').length, 12, 'at most 12');
});

test('a Refresh no longer forwards tastes: the call, the file and the option are gone', () => {
    assert.doesNotMatch(read('modules/people/calls/runtime-targeted.js'), /forwardTastesToHost/);
    assert.doesNotMatch(read('modules/people/runtime/runtime-hosted.js'), /createTastes/);
    assert.doesNotMatch(read('modules/people/runtime/runtime-hosted-parts/target-notes.js'), /askTastes/);
});

test('the defaults are every 4 replies, 1 person per reply, and a failed catch-up shows the fill-in note with nothing written', () => {
    assert.match(read('modules/people/settings/runtime-settings-parts/defaults.js'), /narrationCaptureCatchUp: 4,/);
    assert.match(read('modules/people/settings/runtime-settings-parts/get-settings.js'), /narrationCaptureCatchUp\)\)\)[^\n]*: 4\)/);
    assert.match(read('modules/people/settings/runtime-settings-parts/defaults.js'), /narrationCaptureCatchUpPeople: 1,/);
    const source = read('modules/people/calls/runtime-targeted-refresh.js');
    assert.match(source, /if \(automatic\) \{ if \(error\?\.code !== 'NPC_SCANNER_ROUTE_CANCELLED'\) globalThis\.toastr\?\.warning\?\.\(fillFailureNote\(existing\.name\)\); \}/);
    assert.match(fillFailureNote('Myla'), /the profile for Myla could not be filled in\./);
    assert.doesNotMatch(source.slice(source.indexOf('onError:'), source.indexOf('onError:') + 600), /commit|setChatState/, 'the error path writes nothing');
});

test('a Refresh answer without the keep states and mood numbers is accepted, and a returned tastes key or edges key is ignored (old journaled answers too)', () => {
    const base = normalizeNpcRecord({ id: 'myla', name: 'Myla Venn', role: 'clerk', mood: 'calm' });
    const answer = { npcs: [{ id: 'myla', name: 'Myla Venn', mood: 'wary', location: 'the archive', relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 }, tastes: [{ sign: '+', item: 'tea', from: 'x' }] }], keyRelationshipEdges: [] };
    const { state } = mergeScanResult({ npcs: [base], candidates: [], turn: 1 }, answer, { skipRelationshipUpdate: true, preservePresence: true });
    const npc = state.npcs.find(item => item.id === 'myla');
    assert.equal(npc.mood, 'wary');
    assert.equal(npc.location, 'the archive');
    assert.equal(npc.tastes, undefined, 'tastes are recorded by the story lines only');
});
