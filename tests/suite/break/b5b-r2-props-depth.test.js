// B-b5b-robust-r2-3: the depth caps (64 elements, 8 @-rules, pack JSON 16) miss a widget's `data-props`,
// JSON inside a template string. Props nested 2 000–3 000 deep (12–18 KB) make renderTemplate itself throw
// (structuredClone / fill recursion: "Maximum call stack size exceeded"; in Chromium at 3 000 deep "Cannot
// read properties of null (reading 'bind')") instead of the widget's own "failed" note. (A pack's own screens are no longer read, so the pack-install half of this test is gone.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { compileTemplate, renderTemplate } from '../../../ui/legacy/view/template/index.js';
import { standardWidgets } from '../../../ui/legacy/view/widgets/index.js';

const template = depth => `<ss-widget name="ss.badge" data-props='${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}'></ss-widget>`;

test('B-b5b-robust-r2-3: deeply nested data-props never make renderTemplate throw', () => {
    const doc = installFakeDom();
    const el = doc.createElement('div');
    assert.doesNotThrow(() => renderTemplate(el, compileTemplate(template(3000)), {}, { evaluate: () => true, widgets: standardWidgets }));
});
