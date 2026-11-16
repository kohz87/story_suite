// The demo form of the sample: a made-up module's settings schema, drawn by the form engine over an in-memory store.

import { chipsField, newId, renderSettingsForm, sectionBlock } from '../../view/form/index.js';
import { createSettings } from '../../../../../../core/sdk.js';

/**
 * The demo form (the form engine, view/form/): a made-up module's settings schema in the registry's own shape,
 * drawn with the engine's renderers and written through a real settings store held in memory (nothing of the reader's
 * is touched). It has one of each field: a switch, text and a text area, a number, a slider, a select, one-of
 * chips, a Connection Manager profile, a list of "Name: Worth" lines, and read-only rows (one by `shows`, one
 * that follows the switch); the groups come from `group` and from a label's "Group: " prefix.
 */
export const UI_SAMPLE_FORM = Object.freeze({
    moduleId: 'demo',
    title: 'Demo form: one module\'s settings, from its schema',
    schema: Object.freeze({
        strict: Object.freeze({ type: 'bool', label: 'Strict checks', help: 'Code picks the stat and difficulty from your message. One cheap call per message.' }),
        harder: Object.freeze({ type: 'int', label: 'Check difficulty', min: 1, max: 5, help: 'Locked while Strict checks is off.', readOnly: values => values.strict !== true, shows: () => 3 }),
        storyTitle: Object.freeze({ type: 'text', label: 'Story title', help: 'Shown in the header.', max: 24 }),
        notes: Object.freeze({ type: 'text', multiline: true, label: 'Narrator notes', help: 'Anything the narrator should keep in mind.', max: 160 }),
        pace: Object.freeze({ type: 'choice', form: 'chips', label: 'Pace', options: Object.freeze([Object.freeze({ value: 'slow', label: 'Slow' }), Object.freeze({ value: 'steady', label: 'Steady' }), Object.freeze({ value: 'fast', label: 'Fast' })]) }),
        pack: Object.freeze({ type: 'text', label: 'Pack', help: 'Set by the pack in use.', readOnly: true, shows: () => 'Ersveil: Bluewatch' }),
        budget: Object.freeze({ type: 'int', form: 'slider', min: 0, max: 200, unit: ' pennies', label: 'Money: Starting purse', help: 'The coins the party starts with.', group: 'Money' }),
        prices: Object.freeze({ type: 'choice', label: 'Prices by place', group: 'Money', options: Object.freeze([Object.freeze({ value: 'by-place', label: 'Settlement type × surroundings (±30%)' }), Object.freeze({ value: 'flat', label: 'Flat prices everywhere' })]) }),
        coins: Object.freeze({
            type: 'list', label: 'Coins', group: 'Money', help: 'One coin per row, smallest first. The story\'s "40 silver" is paid as 400 pennies.',
            of: Object.freeze({ name: Object.freeze({ type: 'text', label: 'Name', max: 20 }), worth: Object.freeze({ type: 'int', label: 'Worth', min: 1, max: 1000000 }) }),
        }),
        daysPerWeek: Object.freeze({ type: 'int', label: 'Calendar: Days per week', min: 1, max: 12, help: 'The most is 12.' }),
        months: Object.freeze({
            type: 'list', form: 'lines', label: 'Calendar: Months', help: 'Name: Days, one a line.',
            of: Object.freeze({ name: Object.freeze({ type: 'text', label: 'Name', max: 20 }), days: Object.freeze({ type: 'int', label: 'Days', min: 1, max: 60 }) }),
        }),
        connection: Object.freeze({ type: 'profile', label: 'Assist: Connection for extra calls', group: 'Assist', help: 'Used by Assist, Delta\'s scan and the arc planner.' }),
    }),
    defaults: Object.freeze({
        strict: false, harder: 3, storyTitle: 'The Lowmere', notes: '', pace: 'steady', pack: '', budget: 60, prices: 'by-place', daysPerWeek: 7, connection: '',
        coins: Object.freeze([Object.freeze({ name: 'penny', worth: 1 }), Object.freeze({ name: 'copper bit', worth: 1 }), Object.freeze({ name: 'silver', worth: 10 })]),
        months: Object.freeze([Object.freeze({ name: 'Frostmoon', days: 30 }), Object.freeze({ name: 'Seedmoon', days: 31 })]),
    }),
    // What the Connection Manager would answer (names only), so the sample shows a real select.
    profiles: Object.freeze({ usable: true, profiles: Object.freeze([Object.freeze({ name: 'Flash Lite (cheap)' }), Object.freeze({ name: 'Main' })]) }),
    chips: Object.freeze({
        label: 'The safety net may add', help: 'Never coin, new items, XP, loot or healing.',
        options: Object.freeze(['time', 'place', 'present', 'weather', 'quest progress', 'wounds', 'hand-overs']), value: Object.freeze(['time', 'place', 'present', 'weather', 'quest progress', 'wounds']),
    }),
});

/**
 * Draws the demo form into `slot`: the engine's form over an in-memory settings store, a row of several-of chips (the
 * chip picker used on its own), and a line that shows what the store holds after each change. → { destroy() }.
 */
export function mountDemoForm(doc, slot) {
    const D = UI_SAMPLE_FORM;
    const es = {};
    const settings = createSettings({ root: () => es, registry: { module: id => (id === D.moduleId ? { settings: { schema: D.schema, defaults: structuredClone(D.defaults) } } : null) } });
    const stored = doc.createElement('p');
    stored.className = 'ss-sample-stored';
    const show = () => { stored.textContent = `Stored: ${JSON.stringify(es.storySuite?.modules?.[D.moduleId] ?? {})}`; };
    const form = renderSettingsForm(slot, { moduleId: D.moduleId, schema: D.schema, settings, doc, title: D.title, search: true, profiles: () => D.profiles, onChange: show });
    const section = sectionBlock(doc, { title: 'Chip picker' });
    const row = doc.createElement('div');
    row.className = 'ss-field';
    const text = doc.createElement('div');
    text.className = 'ss-field-text';
    const label = doc.createElement('span');
    label.className = 'ss-field-label';
    label.id = newId('chips-label');
    label.textContent = D.chips.label;
    const help = doc.createElement('small');
    help.className = 'ss-field-help';
    help.textContent = D.chips.help;
    text.append(label, help);
    const chips = chipsField({ doc, id: newId('chips'), key: 'chips', field: { type: 'choice', multiple: true, options: D.chips.options }, value: [...D.chips.value], labelledBy: label.id, onChange: () => {} });
    const control = doc.createElement('div');
    control.className = 'ss-field-control';
    control.appendChild(chips.el);
    row.append(text, control);
    section.body.appendChild(row);
    slot.append(section.el, stored);
    show();
    return { form, destroy() { form.destroy(); section.el.remove(); stored.remove(); } };
}
