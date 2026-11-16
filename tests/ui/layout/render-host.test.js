import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLayout, tabFromLayout, part } from '../../../ui/legacy/layout/index.js';
import { mount, fakeQuery, layoutOf, one, settle } from './helpers/fake-dom.js';
import { texts } from '../../helpers/ui-fake-dom.js';
import { pc } from './render.helpers.js';

test('failed and missing queries leave parts empty and are listed as problems', () => {
    const { host } = mount();
    const query = fakeQuery({ obj: { a: { b: 1 } }, later: () => Promise.resolve(1) });
    const result = renderLayout(host, layoutOf({
        type: 'col', children: [
            { type: 'text', bind: { query: 'nope' } },
            { type: 'text', bind: { query: 'obj', path: 'a' } },
            { type: 'text', bind: { query: 'obj', path: 'a.missing.deeper' } },
            { type: 'text', bind: { query: 'later' } },
            { type: 'text', value: 'still drawn' },
        ],
    }), { query });
    assert.deepEqual(texts(host, '.ss-l-text'), ['', '', '', '', 'still drawn']);
    assert.equal(result.ok, true);
    assert.match(result.problems[0], /root\.children\[0\]: query nope failed: no query nope/);
    assert.match(result.problems[1], /root\.children\[1\]: a list or record can't be shown as text/);
    assert.match(result.problems[2], /query later answered later/);
    assert.equal(result.problems.length, 3);

    const noData = renderLayout(host, layoutOf({ type: 'text', bind: { query: 'obj' } }));
    assert.match(noData.problems[0], /there is no data to show here/);
});

test('paths only follow own properties', () => {
    const { host } = mount();
    const query = fakeQuery({ obj: { name: 'x' } });
    renderLayout(host, layoutOf({ type: 'text', bind: { query: 'obj', path: 'name.length' } }), { query });
    assert.equal(one(host, '.ss-l-text').textContent, '');
});

test('an invalid layout draws its errors as text instead of the screen', () => {
    const { host } = mount();
    const result = renderLayout(host, layoutOf({ type: 'marquee', value: '<b>hi</b>' }));
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ['root: "marquee" is not a node type']);
    assert.ok(one(host, '.ss-l-invalid'));
    assert.deepEqual(texts(host, '.ss-l-invalid-list li'), ['root: "marquee" is not a node type']);
});

test('text from data stays text: markup and scripts are never parsed', () => {
    const { host } = mount();
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const query = fakeQuery({ evil: { name: evil } });
    renderLayout(host, layoutOf({
        type: 'box', title: evil, children: [
            { type: 'text', bind: { query: 'evil', path: 'name' } },
            { type: 'button', label: evil, command: 'a.b' },
        ],
    }), { query });
    assert.equal(one(host, '.ss-l-box-title').textContent, evil);
    assert.equal(one(host, '.ss-l-text').textContent, evil);
    assert.equal(host.querySelectorAll('img').length, 0);
    assert.equal(host.querySelectorAll('script').length, 0);
});

test('widgets from a registry render with resolved props and the api', async () => {
    const { host } = mount();
    const seen = [];
    const widgets = {
        'rpg-battle.actor-card': {
            render(el, props, api) {
                seen.push({ props, item: api.item, index: api.index, hasQuery: typeof api.query === 'function' });
                const name = el.ownerDocument.createElement('span');
                name.textContent = props.value?.name ?? '';
                el.appendChild(name);
                api.command('party.rest', { actor: props.actor });
            },
        },
        broken: { render() { throw new Error('kaput'); } },
        text: { render() { throw new Error('a widget never replaces a built-in'); } },
    };
    const calls = [];
    const query = fakeQuery({ 'party.actors': [{ id: 'ac_1', name: 'Ren' }], 'party.actor': ({ id }) => ({ id, name: `Actor ${id}` }) });
    const result = renderLayout(host, layoutOf({
        type: 'col', children: [
            { type: 'list', bind: { query: 'party.actors' }, item: { type: 'rpg-battle.actor-card', props: { actor: '$item.id', compact: true }, bind: { query: 'party.actor', args: { id: '$item.id' } } } },
            { type: 'broken' },
            { type: 'text', value: 'plain' },
        ],
    }), { query, widgets, command: (type, payload) => { calls.push([type, payload]); return { ok: true }; } });
    assert.equal(result.ok, true);
    const card = one(host, '[data-widget="rpg-battle.actor-card"]');
    assert.ok(card.classList.contains('ss-l-widget'));
    assert.equal(card.textContent, 'Actor ac_1');
    assert.deepEqual(seen, [{ props: { actor: 'ac_1', compact: true, value: { id: 'ac_1', name: 'Actor ac_1' } }, item: { id: 'ac_1', name: 'Ren' }, index: 0, hasQuery: true }]);
    assert.deepEqual(calls, [['party.rest', { actor: 'ac_1' }]]);
    assert.equal(one(host, '[data-widget="broken"]').childNodes.length, 0);
    assert.match(result.problems.join('\n'), /root\.children\[1\]: widget broken failed: kaput/);
    assert.equal(texts(host, '.ss-l-text').at(-1), 'plain');
});

test('drawing stops at the part budget', () => {
    const { host } = mount();
    const rows = Array.from({ length: 200 }, (_, i) => ({ i, sub: Array.from({ length: 20 }, () => 0) }));
    const query = fakeQuery({ rows });
    const result = renderLayout(host, layoutOf({ type: 'list', bind: { query: 'rows' }, item: { type: 'list', bind: '$item.sub', item: { type: 'text', value: '$item' } } }), { query });
    assert.ok(host.querySelectorAll('.ss-l-text').length < 3000);
    assert.match(result.problems.join('\n'), /more than 3000 parts/);
});

test('tabFromLayout gives the tab host a tab that renders from view and api', async () => {
    const { host } = mount();
    const layout = layoutOf({
        type: 'col', children: [
            { type: 'text', bind: { query: 'party.pc', path: 'name' } },
            { type: 'when', cond: 'yes', children: [{ type: 'button', label: 'Rest', command: 'party.rest', payload: { kind: 'short' } }] },
            { type: 'my.widget' },
        ],
    }, { id: 'pack.demo/sheet', title: 'Sheet', icon: 'fa-id-card' });
    const tab = tabFromLayout(layout, { widgets: { 'my.widget': { render(el) { el.dataset.mine = 'base'; } } } });
    assert.equal(tab.id, 'pack.demo/sheet');
    assert.equal(tab.title, 'Sheet');
    assert.equal(tab.icon, 'fa-id-card');
    assert.equal(typeof tab.render, 'function');

    const calls = [];
    const view = { state: {}, query: fakeQuery({ 'party.pc': pc }), settings: {}, chat: { length: 3, lastUser: '' } };
    const api = {
        command: (type, payload) => { calls.push([type, payload]); return Promise.resolve({ ok: true }); },
        evaluate: cond => cond === 'yes',
        widgets: { 'my.widget': { render(el) { el.dataset.mine = 'api'; } } },
    };
    const result = tab.render(host, view, api);
    assert.equal(result.ok, true);
    assert.equal(one(host, '.ss-l-text').textContent, 'Ren');
    assert.equal(one(host, '[data-widget="my.widget"]').dataset.mine, 'api', 'api widgets win over the tab\'s own');
    host.querySelector('button').click();
    await settle();
    assert.deepEqual(calls, [['party.rest', { kind: 'short' }]]);

    // A read-only mount (no api): buttons disabled, conditions hidden.
    tab.render(host, view);
    assert.equal(host.querySelectorAll('button').length, 0);
});

test('the part registers nothing in the state', () => {
    assert.deepEqual(part.domains, {});
    assert.deepEqual(part.commands, {});
    assert.deepEqual(part.queries, {});
    assert.equal(part.context.static(), '');
    assert.deepEqual(part.tabs, []);
});

test('ensureLayoutStyles puts the stylesheet in the page once', async () => {
    const { ensureLayoutStyles, LAYOUT_CSS, LAYOUT_STYLE_ID } = await import('../../../ui/legacy/layout/index.js');
    const { doc } = mount();
    assert.equal(ensureLayoutStyles(doc), false, 'no <head>, nothing to do');
    doc.head = doc.createElement('head');
    doc.getElementById = id => doc.head.querySelector(`#${id}`);
    assert.equal(ensureLayoutStyles(doc), true);
    assert.equal(ensureLayoutStyles(doc), true);
    const styles = doc.head.querySelectorAll('style');
    assert.equal(styles.length, 1);
    assert.equal(styles[0].id, LAYOUT_STYLE_ID);
    assert.equal(styles[0].textContent, LAYOUT_CSS);
});

test('a screen\'s bare tree { root } renders; a tab without id, title or icon shows why', () => {
    const { host } = mount();
    const result = renderLayout(host, { root: { type: 'text', value: 'bare' }, theme: { tokens: { accent: 'teal' } } });
    assert.equal(result.ok, true);
    assert.equal(one(host, '.ss-l-text').textContent, 'bare');
    assert.equal(one(host, '.ss-l-root').dataset.layout, undefined);
    assert.equal(one(host, '.ss-l-root').style.getPropertyValue('--ss-l-accent'), 'teal');
    assert.deepEqual(renderLayout(host, { id: 'BAD', root: { type: 'text', value: 'x' } }).errors, ['layout.id: must be a short lowercase id (letters, digits, . _ / -)'], 'present fields are still checked');

    const tab = tabFromLayout({ root: { type: 'text', value: 'bare' } });
    const shown = tab.render(host, {}, {});
    assert.equal(shown.ok, false);
    assert.deepEqual(shown.errors, [
        'layout.id: must be a short lowercase id (letters, digits, . _ / -)',
        'layout.title: must be text of 1 to 60 characters',
        'layout.icon: must be a Font Awesome icon name like fa-box',
    ]);
    assert.ok(one(host, '.ss-l-invalid'));
});

test('widgets also get preview, commit and on when the host gives them', () => {
    const { host } = mount();
    let api;
    const preview = () => {};
    const commit = () => {};
    const on = () => {};
    const tab = tabFromLayout(layoutOf({ type: 'my.board' }), { widgets: { 'my.board': { render(el, props, given) { api = given; } } } });
    tab.render(host, { query: () => null }, { preview, commit, on, evaluate: 'not a function' });
    assert.equal(api.preview, preview);
    assert.equal(api.commit, commit);
    assert.equal(api.on, on);
    assert.equal(api.evaluate, undefined);
    assert.equal(api.command, undefined);

    renderLayout(host, layoutOf({ type: 'my.board' }), { widgets: { 'my.board': { render(el, props, given) { api = given; } } } });
    assert.deepEqual(Object.keys(api).sort(), ['command', 'evaluate', 'index', 'item', 'query']);
});
