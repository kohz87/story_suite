// The Inventory screen's own style sheet (packs/screens/defaults): the actions sit on the right of the row, beside the name,
// on every width; the gear row's pencil keeps an unclipped 44px tap area.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryScreen } from '../../../packs/screens/defaults/index.js';

// The declarations of the first rule whose selector list is exactly `selector` (it starts a line), inside `css` (from `at` when given).
function rule(css, selector, at = '') {
    const from = at ? css.indexOf(at) : 0;
    assert.ok(from >= 0, `no ${at}`);
    const head = new RegExp(`(^|\\n)[ \\t]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`);
    const match = css.slice(from).match(head);
    if (!match) return '';
    const open = from + match.index + match[0].length;
    return css.slice(open, css.indexOf('}', open));
}

test('the Inventory: the actions sit on the right of the row beside the name, centred, on every width; notes and detail under the name; a fold below', () => {
    const css = inventoryScreen.css;
    const body = rule(css, '.item > .body');
    assert.match(body, /grid-template-columns: minmax\(0, 1fr\) fit-content\(50%\);/, 'the name column, then at most half the row for the actions');
    assert.match(body, /grid-template-rows: 1fr auto auto auto 1fr auto;/, 'room above and below the text, so it is centred on taller actions');
    assert.match(body, /align-items: center;/);
    assert.match(rule(css, '.item > .body > .line'), /grid-column: 1; grid-row: 2;/);
    assert.match(rule(css, '.item > .body > .note'), /grid-column: 1; grid-row: 3;/);
    assert.match(rule(css, '.item > .body > .detail'), /grid-column: 1; grid-row: 4;/);
    const actions = rule(css, '.item > .body > .actions');
    assert.match(actions, /grid-column: 2; grid-row: 1 \/ 6;/, 'beside the name, the note and the detail, centred on them');
    assert.match(actions, /justify-content: flex-end;/);
    assert.match(rule(css, '.item > .body > .fold'), /grid-column: 1 \/ -1; grid-row: 6;/, 'the fold opens below the name and the actions');
    // The text column never paints under the actions: it may shrink, long names break anywhere, the chips wrap and are cut to it.
    for (const part of ['min-width: 0;', 'max-width: 100%;', 'overflow-wrap: anywhere;']) {
        assert.ok(rule(css, '.item > .body > :is(.line, .note, .detail)').includes(part), part);
        assert.ok(rule(css, '.item > .body > .line > *').includes(part), `${part} (the name and the chips)`);
    }
    assert.match(rule(css, '.line'), /flex-wrap: wrap;/);
    // A group that wraps on the right when the row is narrow; never a line of its own under the row.
    assert.match(rule(css, '.actions'), /display: flex; flex-wrap: wrap;/);
    assert.doesNotMatch(css, /@(?:container|media)[^{]*\{[^}]*\.actions/, 'the same layout on a phone');
    // The tile stays put when a fold opens.
    assert.match(rule(css, '.item:has(> .body > .fold)'), /align-items: start;/);
    // The template keeps its order: name line, note, detail, actions, folds.
    // (the gear-off sections: the template as it was; the gear-on rows have their own three lines, tested after it)
    const off = inventoryScreen.template.slice(inventoryScreen.template.indexOf('q.gx == null &&'));
    const order = ['class="line"', 'class="note', 'class="actions"', 'class="fold '].map(part => off.indexOf(part));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    // Gear on (GR-UI2): name line, who has it, the detail line (bonus, condition, note), actions, folds.
    const on = inventoryScreen.template.slice(inventoryScreen.template.indexOf('q.gx != null &&'), inventoryScreen.template.indexOf('q.gx == null &&'));
    const gearOrder = ['class="line g-l1"', 'class="g-l2"', 'class="detail gear-line g-l3"', 'class="actions"', 'class="fold '].map(part => on.indexOf(part));
    assert.ok(gearOrder.every(at => at >= 0));
    assert.deepEqual([...gearOrder].sort((a, b) => a - b), gearOrder);
});

test('the gear row\'s pencil keeps an unclipped 44px tap area: its line clips along the row only, and the pencil\'s ::after is 44px', () => {
    const css = inventoryScreen.css;
    assert.match(css, /> \.g-l1 \{ overflow-x: clip; overflow-y: visible; \}/);
    assert.match(css, /\.item-edit \.ss-w-editable-pencil \{[^}]*min-height: 0 !important;/);
    assert.match(rule(css, '.inv.gear .g-l1 .item-edit .ss-w-editable-pencil::after'), /height: calc\(44px \/ var\(--ss-zoomed, 1\)\);/);
});
