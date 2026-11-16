import { hero } from '../../../src/v2/view/widgets/hero.js';
import { fakeApi, host as widgetHost, installDom } from './widgets/fake-dom.js';

export const settle = async () => { for (let n = 0; n < 6; n += 1) await new Promise(resolve => setImmediate(resolve)); };
export const WHERE = { present: ['Fenna', 'Hooded courier'], places: [{ name: 'Bluewatch Village' }, { name: 'The Weir' }], weatherOn: true, place: 'Bluewatch Village', weatherText: 'heavy rain, rising river' };
export const MONTHS = ['Dawnwane', 'Rainmoot', 'Greengale', 'Highsun', 'Goldwane', 'Haywane'].map(name => ({ name, days: 30 }));
export const CLOCK = { parts: { year: 611, month: 5, day: 12, minutes: 13 * 60 + 30 }, era: 'CY', months: MONTHS };
export const YOU = { rank: 'F-rank', rankLabel: 'Guild rank', wearing: 'oilskin coat', condition: 'soaked', command: 'scene.you' };
export const LEAD = { name: 'Wessel', place: 'Bluewatch Village', time: 'CY 611, Goldwane 12, 1:30 pm', weather: 'heavy rain, rising river', where: WHERE, you: YOU, clock: CLOCK };

export function draw(props, api = fakeApi()) {
    const doc = installDom();
    const el = widgetHost(doc);
    const handle = hero.render(el, props, api);
    const kinds = () => el.querySelectorAll('.ss-hero-corner-item').map(item => item.getAttribute('data-kind'));
    const item = kind => el.querySelector(`.ss-hero-corner-item[data-kind="${kind}"]`);
    const words = kind => item(kind)?.querySelector('.ss-hero-corner-text')?.textContent;
    const edit = () => el.querySelector('button.ss-hero-edit');
    // the box of a field, by its label (the fake DOM's selectors split at spaces, so a label like "Year (CY)" is found by its text)
    const box = label => {
        const node = el.querySelectorAll('.ss-hero-editor label').find(each => each.querySelector('span').textContent === label);
        return node ? node.querySelector('input') ?? node.querySelector('select') : null;
    };
    const legends = () => el.querySelectorAll('.ss-hero-editor legend').map(node => node.textContent);
    const labels = () => el.querySelectorAll('.ss-hero-editor label').map(node => node.querySelector('span').textContent);
    const save = () => el.querySelector('.ss-hero-editor .ss-w-editable-save');
    const cancel = () => el.querySelector('.ss-hero-editor .ss-w-editable-cancel');
    const error = () => el.querySelector('.ss-hero-editor .ss-w-editable-error')?.textContent;
    const form = () => el.querySelector('.ss-hero-editor .ss-w-editable-form');
    return { el, doc, handle, api, kinds, item, words, edit, box, legends, labels, save, cancel, error, form };
}
export const sent = api => api.commands.map(call => [call.type, call.payload]);
// An api whose command answers by type: `{ ok: false, message }` for the ones listed.
export function answering(refuse = {}) {
    const api = fakeApi();
    api.command = (type, payload) => { api.commands.push({ type, payload }); return Promise.resolve(refuse[type] ?? { ok: true }); };
    return api;
}
