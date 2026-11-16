// The Journal and the Hooks list keep their text inside their cards: the rules the screenshots of 8 Nov asked for.

import test from 'node:test';
import assert from 'node:assert/strict';

import { worldScreen } from '../../../../modules/world/world/index.js';
import { directorScreen } from '../../../../ui/legacy/director/screens/director.js';

const rule = (css, selector) => css.split('\n').find(line => line.startsWith(selector)) ?? '';

test('Journal lines wrap inside the card, grid children may shrink, section rules stop at the card edge', () => {
    const css = worldScreen.css;
    assert.match(rule(css, '.wv-journal, .wv-journal li'), /overflow-wrap: anywhere/);
    assert.match(rule(css, '.wv, .wv-journal'), /minmax\(0, 1fr\)/);
    assert.match(rule(css, '.wv-fold, .wv-part'), /min-width: 0/);
    assert.match(rule(css, '.wv-part .wv-label'), /overflow: hidden/);
    assert.match(rule(css, '.wv-find-label') + rule(css, '.wv-journal, .wv-journal li'), /wv-find-label/);
});

test('the Director cards wrap their text and grow with their rows: no inner scroll box, no nowrap but the tag', () => {
    const css = directorScreen.css;
    assert.match(rule(css, '.sd-problem .sd-ptag'), /white-space: nowrap/);
    assert.match(rule(css, '.sd-thread .sd-key'), /overflow-wrap: anywhere/);
    assert.doesNotMatch(css, /overflow-y: (auto|scroll)/, 'no inner scroll box anywhere');
    assert.doesNotMatch(css, /max-height/, 'a card grows with its rows');
});

test('layouts come from the screen\'s own width: no window-width media query in the Story Director screens', async () => {
    const { chronicleScreen } = await import('../../../../modules/world/chronicle/screen.js');
    const { questsScreen } = await import('../../../../ui/legacy/director/screens/quests.js');
    const { MAP_CSS } = await import('../../../../modules/atlas/atlas/widget-css.js');
    const all = [worldScreen.css, directorScreen.css, chronicleScreen.css, questsScreen.css, MAP_CSS].join('\n');
    assert.doesNotMatch(all, /@media[^{]*\((min|max)-width/, 'switch on the pointer or on the container, not on the window');
    assert.match(rule(worldScreen.css, '.wv-now { grid-template-columns'), /minmax\(min\(320px, 100%\), 1fr\)/);
    assert.match(rule(chronicleScreen.css, '.ch-events .ch-list'), /minmax\(min\(300px, 100%\), 1fr\)/);
});

test('the shows-spoilers pill reads the warn text colour, and the pulse heads are the mockup\'s ruled capitals', async () => {
    assert.match(rule(directorScreen.css, '.sd-spoil'), /color: var\(--ss-warn-text, var\(--sd-warn\)\)/);
    const { SHARED_CSS } = await import('../../../../ui/legacy/director/screens/style.js').then(m => ({ SHARED_CSS: Object.values(m).find(v => typeof v === 'string' && v.includes('.sd-pulse .sd-h')) }));
    assert.match(rule(SHARED_CSS, '.sd-pulse .sd-h {'), /text-transform: uppercase/);
});
