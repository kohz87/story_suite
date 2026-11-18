// J11 step 5 review fix: changed(['*']) is everything, whatever a section's keys. (The Diagnostics "Redraw all" button was the old page's scheduler.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanels } from '../../../core/sdk/panels.js';
import { panelsTarget } from '../../helpers/panels-target.js';

const section = (drawn, name, keys = ['people']) => ({ keys, isVisible: () => true, read: () => 'v', draw: () => drawn.push(name), drawn: true });

test("changed(['*']) counts as everything: every section draws, whatever its keys", () => {
    const drawn = [];
    const { panels, bind } = createPanels({ on: () => true });
    const { target, frame } = panelsTarget();
    bind(target);
    panels.register('people', section(drawn, 'people'));
    panels.register('bag', section(drawn, 'bag', ['bag']));
    frame();
    panels.changed(['*']);
    frame();
    assert.deepEqual(drawn.sort(), ['bag', 'people']);
});
