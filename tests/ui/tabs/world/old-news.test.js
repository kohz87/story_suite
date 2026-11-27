// Old news (stale) shows as "old news" under its own Older filter and last under All; the editor ends it, or removes a faction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { newsCard } from '../../../../ui/tabs/world/news.js';
import { openWorldEditor } from '../../../../ui/tabs/world/editor.js';
import { worldTab } from '../../../../ui/tabs/world/world.js';
import { selectWorld } from '../../../../ui/select/world.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const NEWS = [
    { id: 'ev_1', title: 'Old boom', state: 'ongoing', stale: true, summary: '', heard: [] },
    { id: 'ev_2', title: 'Frost', state: 'ongoing', summary: '', heard: [] },
    { id: 'ev_3', title: 'Cleared', state: 'resolved', summary: '', heard: [] },
];
const act = { placeName: () => null, factionName: () => null, gotoPlace() {}, setView() {}, edit() {} };
const titles = card => card.querySelectorAll('.ev .eh b').map(node => node.textContent);

test('the view-model carries stale and kind and leaves the state as it is', () => {
    const view = selectWorld({ worldView: { news: [{ id: 'ev_1', kind: 'world', name: 'Boom', state: 'ongoing', open: true, stale: true }, { id: 'th_1', kind: 'event', name: 'Bell', state: '', open: true }] } });
    assert.deepEqual(view.news.map(item => [item.kind, item.state, item.stale]), [['world', 'ongoing', true], ['event', 'ongoing', undefined]]);
});

test('old news is last under All, only under Older among the filters, and the chip is there only with old news', () => {
    installFakeDom();
    const card = newsCard(NEWS, { filter: 'all' }, act);
    assert.deepEqual(titles(card), ['Frost', 'Cleared', 'Old boom']);
    assert.deepEqual(card.querySelectorAll('.st').map(node => node.textContent), ['ongoing', 'resolved', 'old news']);
    assert.deepEqual(card.querySelectorAll('.fil button small').map(node => node.textContent), ['3', '0', '1', '0', '1', '1']);
    card.querySelector('[data-nf="ongoing"]').click();
    assert.deepEqual(titles(card), ['Frost']);
    card.querySelector('[data-nf="older"]').click();
    assert.deepEqual(titles(card), ['Old boom']);
    const fresh = newsCard(NEWS.slice(1), { filter: 'older' }, act);
    assert.equal(fresh.querySelector('[data-nf="older"]'), null);
    assert.deepEqual(titles(fresh), ['Frost', 'Cleared']);
});

function open(target) {
    installFakeDom();
    const sent = [];
    const sheet = openWorldEditor({ command: (type, payload) => { sent.push([type, payload]); return Promise.resolve({ ok: true }); } }, target);
    return { sent, form: sheet.body.querySelector('.wsheet') };
}

test('a faction is removed on the second tap', async () => {
    const { sent, form } = open({ kind: 'faction', id: 'fa_1', current: { name: 'Red Cord' } });
    const button = form.querySelector('.remove');
    assert.equal(button.textContent, 'Remove');
    button.click();
    await flush();
    assert.deepEqual(sent, []);
    assert.equal(button.textContent, 'Tap again to remove');
    button.click();
    await flush();
    assert.deepEqual(sent, [['chronicle.remove', { id: 'fa_1' }]]);
});

test('open world news is marked ended; ended news, a dated happening and a place have no such button', async () => {
    const { sent, form } = open({ kind: 'news', id: 'ev_1', current: { name: 'Boom', state: 'ongoing' } });
    form.querySelector('.ended').click();
    await flush();
    assert.deepEqual(sent, [['chronicle.edit', { id: 'ev_1', state: 'resolved' }]]);
    for (const target of [{ kind: 'news', id: 'ev_1', current: { state: 'resolved' } }, { kind: 'news', id: 'th_1', thread: true, current: { state: 'ongoing' } }, { kind: 'place', id: 'p', current: {} }]) {
        const other = open(target).form;
        assert.equal(other.querySelector('.ended'), null);
        assert.equal(other.querySelector('.remove'), null);
    }
});

test('the tab tells the editor when a news item is a dated happening', () => {
    installFakeDom();
    const asked = [];
    const tab = worldTab({ news: [{ id: 'th_1', kind: 'event', title: 'Bell', state: 'ongoing', heard: [] }] }, { view: 'news', edit: target => asked.push(target) });
    tab.querySelector('.ev .ed').click();
    assert.equal(asked[0].thread, true);
});
