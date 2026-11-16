import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/director/ui-fake-dom.js';
import { resolveData, runtime, skipReason } from './helpers/runtime.js';
import { calendar, makeQueries, makeRunner } from './helpers/fixtures.js';
import { screens } from '../../../../ui/legacy/director/screens/index.js';
import { toSlot } from '../../../../modules/rpg/slot.js';
import { headState } from './helpers/fixtures.js';

export const skip = runtime ? false : skipReason;
export const byId = Object.fromEntries(screens.map(screen => [screen.id, screen]));
export const formatters = { time: minutes => (Number.isInteger(minutes) ? calendar.format(minutes) : '') };
export const squash = text => String(text ?? '').replace(/\s+/g, ' ').trim();

export function draw(id, state, { command = null, changes = [], mount = byId[id].mounts[0], queries = makeQueries(), index = undefined, widgets = runtime.widgets } = {}) {
    const { run } = makeRunner(queries);
    const screen = byId[id];
    const doc = installFakeDom();
    doc.head = doc.createElement('head');
    const el = doc.createElement('div');
    el.setAttribute('data-ss-screen', id);
    doc.body.appendChild(el);
    const data = resolveData(screen.data, (name, args) => run(state, name, args));
    assert.equal(data.ok, true);
    const compiled = runtime.compileTemplate(screen.template);
    const warnings = [...compiled.warnings];
    const results = [];
    const view = runtime.renderTemplate(el, compiled, { state, q: data.q, changes, settings: {}, mount, screenId: id, index, api: {} }, {
        evaluate: runtime.evaluate,
        widgets,
        formatters,
        command,
        onWarn: message => warnings.push(message),
        onResult: result => results.push(result),
    });
    return { el, view, warnings, results, doc, data };
}

export const pulseState = (results, quiet = false) => {
    const base = headState();
    const director = { ...base.domains.director, pulse: toSlot({ results }), ...(quiet ? { pulseQuiet: toSlot({ on: true }) } : {}) };
    return { ...base, domains: { ...base.domains, director } };
};
export const rolls = [
    { at: 4, clock: 1, kind: 'ENTER_CHECK', d20: 3, table: 'std', text: 'Joren will reach the Stray Oar soon.', effect: { type: 'director.pulse.arrive', thread: 'th_a' } },
    { at: 6, clock: 2, kind: 'SKIP', skipped: 'fight', text: '' },
    { at: 8, clock: 3, kind: 'OVERHEARD_DETAIL', d20: 14, table: 'std', text: 'The inspector learns Astra paid in false coin.', effect: { type: 'chronicle.rumor', at: 8 } },
];
