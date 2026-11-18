import test from 'node:test';
import assert from 'node:assert/strict';
import {
    fillPresentSceneText,
    NOW_PART_MAX,
    nowParts,
    nowSlotHtml,
    presentSceneModel,
    rememberPresentScene,
    sceneAttr,
} from '../../modules/people/legacy/present-scene.js';
import { runtimeSource } from './helpers/runtime-source.js';
import { styleSource } from './helpers/shipped-modules.js';

// Present NPCs view, display only: the now lines on the cards of the Cast and World panes (B4-6 took the chatter,
// the World State reader and the in-chat cards away).

const cards = [
    { id: 'yun', name: 'Yunyun', aliases: ['Yun'], mood: 'shy', condition: '', outfit: 'travel cloak' },
    { id: 'orrin', name: 'Capt. Orrin Hask', aliases: [], mood: 'calm', condition: 'healthy', outfit: 'armor' },
];

test('v1.2.3 now lines: labelled Mood, Condition and Outfit, only those with a value, barely cut', () => {
    const lines = parts => parts.map(part => [part.label, part.text]);
    assert.deepEqual(lines(nowParts({ mood: 'calm', condition: 'healthy', outfit: 'armor' })), [['Mood', 'calm'], ['Condition', 'healthy'], ['Outfit', 'armor']]);
    assert.deepEqual(lines(nowParts({ mood: '', condition: '', outfit: 'apron' })), [['Outfit', 'apron']]);
    assert.deepEqual(nowParts({}), []);
    assert.deepEqual(nowParts(null), []);
    const mood = 'quietly furious about the broken promise she was made at dawn';
    const [part] = nowParts({ mood });
    assert.equal(part.text, mood, 'a long mood is no longer cut after 48 characters');
    assert.equal(part.title, mood);
    const huge = nowParts({ outfit: 'a rain-soaked travelling cloak over borrowed armor two sizes too large '.repeat(4) })[0];
    assert.ok(huge.text.length <= NOW_PART_MAX && huge.text.endsWith('…'), huge.text);
    assert.ok(huge.title.length > huge.text.length, 'the tooltip carries more than the clamped line');
});

test('the now lines come from the dossier, one slot per value, and the model is never shaped from story text', () => {
    const model = presentSceneModel({ cards });
    const text = now => now.parts.map(part => `${part.label}: ${model.texts[part.text]}`).join(' | ');
    assert.deepEqual(Object.values(model.now).map(text), ['Mood: shy | Look: travel cloak', 'Mood: calm | Condition: healthy | Look: armor']);
    assert.equal(model.texts[model.now.yun.parts[0].title], 'shy', 'each line has its full text for the tooltip');
    assert.deepEqual(Object.keys(model).sort(), ['now', 'signature', 'texts'], 'no chatter, no World State: the scene model is the now lines only');
});

test('the now lines never become markup: slots carry indexes, text arrives by textContent', () => {
    const model = rememberPresentScene(presentSceneModel({ cards: [{ id: 'yun', name: 'Yunyun', mood: '<b>bold</b>' }] }));
    const html = [sceneAttr(model), nowSlotHtml(model, 'yun')].join('');
    assert.doesNotMatch(html, /<b>|bold/, 'no story text in the markup');
    assert.match(html, /data-delta-scene="[^"]+"/);
    const node = (attrs = {}) => ({ attrs, textContent: '', getAttribute: name => attrs[name] ?? null, setAttribute: (name, value) => { attrs[name] = String(value); } });
    const slots = [...html.matchAll(/data-delta-text="(\d+)"/g)].map(match => node({ 'data-delta-text': match[1] }));
    const titled = [...html.matchAll(/data-delta-title="(\d+)"/g)].map(match => node({ 'data-delta-title': match[1] }));
    assert.equal(titled.length, 1, 'one now line (Mood) for this card');
    const section = { getAttribute: name => (name === 'data-delta-scene' ? model.signature : null), matches: selector => selector === '[data-delta-scene]', querySelectorAll: selector => (selector === '[data-delta-text]' ? slots : (selector === '[data-delta-title]' ? titled : [])) };
    assert.equal(fillPresentSceneText(section), slots.length + titled.length);
    assert.deepEqual(slots.map(slot => slot.textContent), ['<b>bold</b>']);
    assert.equal(titled[0].attrs.title, '<b>bold</b>', 'the tooltip is an attribute value, never markup');
    assert.equal(fillPresentSceneText(section), 0, 'unchanged text is not rewritten');
    assert.equal(fillPresentSceneText(null), 0);
    assert.equal(fillPresentSceneText({ querySelectorAll() { throw new Error('boom'); } }), 0, 'never throws');
});

test('v1.2.3 the card shows labelled now lines that wrap to two lines, the name wraps too, full text in a tooltip', () => {
    const model = presentSceneModel({ cards: [{ id: 'astral', name: 'The Astral-Bound Wanderer of the Northern Reach', mood: 'Curious; wary of the strangers at the gate', condition: '', outfit: 'starlit travelling cloak' }] });
    const html = nowSlotHtml(model, 'astral');
    assert.match(html, /^<span class="npc-state-delta-present-now">/);
    assert.match(html, /npc-state-delta-present-now-mood" data-delta-title="\d+"><span class="npc-state-delta-present-now-label">Mood:<\/span> <span class="npc-state-delta-present-now-text" data-delta-text="\d+"><\/span>/);
    assert.match(html, /npc-state-delta-present-now-outfit[^>]*><span class="npc-state-delta-present-now-label">Look:<\/span>/, '1.2.8: the dossier\'s current look');
    assert.doesNotMatch(html, /Condition:/, 'a part without a value has no line');
    assert.doesNotMatch(html, /Curious|starlit/, 'the story text still arrives by textContent');
    assert.equal(model.texts[model.now.astral.parts[0].text], 'Curious; wary of the strangers at the gate');

    const css = styleSource();
    const rule = selector => css.match(new RegExp(`\\n${selector.replace(/[.-]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] || '';
    // UI 4c: the stage line and the now lines are short. The side's now parts wrap to two lines; the name is one line
    // with an ellipsis, so a long unbroken name never makes the row taller or wider.
    assert.match(rule('.npc-state-delta-present-side .npc-state-delta-present-now-part'), /-webkit-line-clamp: 2;/, 'the now lines wrap to two lines at most');
    assert.doesNotMatch(rule('.npc-state-delta-present-side .npc-state-delta-present-now-part'), /white-space: nowrap/, 'and are not cut to one line');
    assert.match(rule('.npc-state-delta-present-card-name'), /white-space: nowrap;/, 'the name is one line');
    assert.match(rule('.npc-state-delta-present-card-name'), /text-overflow: ellipsis/, 'a long name is cut with an ellipsis');
    assert.doesNotMatch(rule('.npc-state-delta-present-card-text'), /background/, 'no footer over the portrait: the text sits on the row');
    assert.doesNotMatch(css, /present-card-overlay/, 'no text over the portrait');
    const index = runtimeSource();
    assert.match(index, /<span class="npc-state-delta-present-card-portrait">\$\{portrait\}<\/span>\s*<span class="npc-state-delta-present-card-text">/);
    assert.doesNotMatch(index, /npc-state-delta-present-chip/, 'B4-6: the compact strip is gone');
});


test('v1.2.4 (UI 4c) present cards are one compact row at every size: a 44px portrait, the name, the now lines under it', () => {
    const css = styleSource();
    // No container split any more: a narrow pane and a wide one show the same single column.
    assert.doesNotMatch(css, /@container npc-present/, 'the card row needs no container query');
    const rule = selector => css.match(new RegExp(`\\n${selector.replace(/[.-]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] || '';
    assert.match(rule('.npc-state-delta-present-grid'), /grid-template-columns: minmax\(0, 1fr\);/, 'one card per line, full width');
    assert.match(rule('.npc-state-delta-present-card'), /grid-template-columns: 44px minmax\(0, 1fr\);/, 'the portrait on the left at 44px');
    assert.match(rule('.npc-state-delta-present-card-portrait'), /width: 44px; height: 44px;/);
    assert.match(rule('.npc-state-delta-present-card .npc-state-delta-present-now'), /display: none/, 'the now lines sit under the row, not on it');
    assert.match(rule('.npc-state-delta-present-side'), /padding: 0 10px 0 64px;/, 'under the row, aligned with the name');
    assert.match(rule('.npc-state-delta-present-cell'), /grid-template-columns: minmax\(0, 1fr\);/);
    assert.match(css, /\n\.npc-state-delta-present-side \{/, 'the side is shown (it was hidden on wide grids)');
    assert.doesNotMatch(css, /present-card-overlay/);
});


test('a malformed scene shapes to nothing instead of throwing', () => {
    const model = presentSceneModel({ cards: 'nope' });
    assert.deepEqual(model.now, {});
    assert.equal(nowSlotHtml(null, 'x'), '');
    assert.equal(sceneAttr(null), '');
});

test('the present cards render now slots; no chat cards, no chatter, no World State reader', () => {
    const index = runtimeSource();
    assert.match(index, /function inlineCardHtml\(npc, messageId, scene = null\)[\s\S]*nowSlotHtml\(scene, npc\.id\)/);
    assert.match(index, /npc-state-delta-present-roster" data-message-id="\$\{messageId\}"\$\{sceneAttr\(scene\)\}/);
    assert.match(index, /fillPresentCast: root => fillPresentSceneText\(root\)/);
    assert.doesNotMatch(index, /worldStatePeople|scenePresentAt|megumin-pane|presentCastDisplay|inline-anchor/, 'B4-6: nothing of the old in-chat path is left');
    assert.match(index, /const side = now \? `<div class="npc-state-delta-present-side npc-state-delta-present-side-now">\$\{now\}<\/div>`\s*: `<div class="npc-state-delta-present-side npc-state-delta-present-side-idle">[^`]*No changes this turn[^`]*`;/, 'right half: the now lines, else role + no changes');
    const css = styleSource();
    assert.doesNotMatch(css, /npc-state-delta-(chatter|bubble|megumin|inline-anchor|present-chip)/, 'no style for what is gone');
});
