// The map page (ST-MAPV): the model (north up, layers, route classes), region areas by region or by climate, realm outlines, a drag
// or an arrow key or a step committing x and y as one undo step, Add a route (with its km guess and the second-route rule), deleting a
// route, Go to selecting a place, the read-only format 3 map, and the page in Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderPage, mapModel } from '../../../studio/views/map.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { serve } from './serve.js';

const BASE = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
function world() {
    const pack = structuredClone(BASE);
    const c = pack.content;
    c.regions.push({ id: 'high-moor', name: 'High Moor', climate: 'cold' });
    c.realms = [{ id: 'lamp-league', name: 'Lamp League', regions: ['the-fen'] }];
    c.routeKinds = { road: 'road', barge: 'river' };
    c.places.push({ id: 'cairn', name: 'Cairn', region: 'high-moor', kind: 'marsh', x: 10, y: 8, hidden: true },
        { id: 'deep-hall', name: 'Deep Hall', region: 'the-fen', x: 1, y: 1, layer: 'underground' });
    c.routes.push({ from: 'reedmoor', to: 'cairn', kind: 'barge', km: 96 });
    return pack;
}

function setup(opts = {}) {
    installFakeDom();
    const pack = opts.pack ?? world();
    const calls = [];
    const keeps = {};
    const ctx = { doc: pack, kind: 'world', legacy: opts.legacy ?? false, refs: buildRefs(pack), focus: opts.focus ?? null, problems: [],
        commit: patches => { calls.push(patches); return opts.commit?.(keeps) ?? { ok: true }; }, keep: id => (keeps[id] ??= {}), go: () => {} };
    if (opts.legacy) delete ctx.commit;
    const root = document.createElement('div');
    const draw = () => { root.replaceChildren(...renderPage(ctx)); return root; };
    return { pack, calls, keeps, draw, ctx };
}
const placeNode = (root, id) => root.querySelector(`[data-pl="${id}"]`);
const tap = (root, id) => { const node = placeNode(root, id).querySelector('circle.b'); node.dispatch('pointerdown', { clientX: 100, clientY: 100 }); root.querySelector('.st-mapbox').dispatch('pointerup', { clientX: 100, clientY: 100 }); };

test('the model draws north up on one layer, keeps routes between drawn places, and reads route classes from routeKinds', () => {
    const model = mapModel(world());
    assert.deepEqual(model.places.map(p => p.id), ['fenhold', 'reedmoor', 'cairn']);
    assert.deepEqual([model.byId.get('reedmoor').x, model.byId.get('reedmoor').y], [30, -20], 'north is up: y is drawn upwards');
    assert.deepEqual(model.routes.map(r => r.cls), ['road', 'river']);
    assert.equal(model.faint.length, 1, 'the underground place is a faint dot');
    assert.equal(model.byId.get('cairn').climate, 'cold', 'a place reads its region\'s climate');
    const under = mapModel(world(), 'underground');
    assert.deepEqual(under.places.map(p => p.id), ['deep-hall']);
    assert.deepEqual([...under.layers.entries()], [['', 3], ['underground', 1]]);
});

test('the page draws region areas, the realm outline with its name, routes and places; Climates recolours and its legend counts', () => {
    const { draw } = setup();
    let root = draw();
    assert.equal(root.querySelectorAll('.st-mp .area').length, 2);
    assert.match(root.querySelector('.st-mp .realm text').textContent, /LAMP LEAGUE · REALM/);
    assert.equal(root.querySelectorAll('.st-mp .rt').length, 2);
    assert.ok(root.querySelector('.st-mp .rt.c-river'));
    assert.ok(placeNode(root, 'cairn').classList.contains('hid'));
    assert.match(root.querySelector('.st-mside').textContent, /Nothing selected/);
    assert.match(root.querySelector('.st-mleg').textContent, /relay road.*river.*realm/);
    root.querySelector('[data-colour="climates"]').click();
    root = draw();
    assert.match(root.querySelector('.st-mleg').textContent, /cold 1/);
    assert.match(root.querySelector('.st-mleg').textContent, /not set: reads as temperate 1/);
    assert.ok(root.querySelector('.st-mp .area.unset'), 'a region with no climate is marked');
    assert.match(root.querySelector('.st-mside').textContent, /Regions with no climate · 1/);
});

test('a game pack, or a world with no placed places, draws no page (so the Map segment stays hidden)', () => {
    installFakeDom();
    assert.deepEqual(renderPage({ doc: world(), kind: 'game', keep: () => ({}) }), []);
    const bare = world();
    bare.content.places = [{ id: 'nowhere', name: 'Nowhere' }];
    assert.deepEqual(renderPage({ doc: bare, kind: 'world', keep: () => ({}) }), []);
});

test('dragging a place commits its x and y as one edit, rounded to map units, and selects it', () => {
    const { calls, keeps, draw } = setup();
    const root = draw();
    const box = root.querySelector('.st-mapbox');
    const u = keeps['map:view'].vb.w / 640;
    placeNode(root, 'reedmoor').querySelector('circle.b').dispatch('pointerdown', { clientX: 100, clientY: 100 });
    box.dispatch('pointermove', { clientX: 100 + 20 / u, clientY: 100 - 30 / u });
    assert.match(root.querySelector('.st-mtip').textContent, /x 5 · y 5 {3}was 3 · 2/);
    box.dispatch('pointerup', { clientX: 100 + 20 / u, clientY: 100 - 30 / u });
    assert.deepEqual(calls, [[{ op: 'set', path: ['content', 'places', 1, 'x'], value: 5 }, { op: 'set', path: ['content', 'places', 1, 'y'], value: 5 }]]);
    assert.deepEqual(keeps['map:view'].sel, { place: 'reedmoor' });
    assert.match(keeps['map:view'].note, /Moved from 3, 2/);
});

test('a move\'s note is set before the commit draws the page again; a refused one says why', () => {
    let refuse = false;
    const notes = [];
    const { keeps, draw } = setup({ commit: kept => { notes.push(kept['map:view'].note); return refuse ? { ok: false, refusal: 'Not now.' } : { ok: true }; } });
    const drag = () => {
        const root = draw();
        const box = root.querySelector('.st-mapbox');
        const u = keeps['map:view'].vb.w / 640;
        placeNode(root, 'reedmoor').querySelector('circle.b').dispatch('pointerdown', { clientX: 100, clientY: 100 });
        box.dispatch('pointermove', { clientX: 100 + 20 / u, clientY: 100 - 30 / u });
        box.dispatch('pointerup', { clientX: 100 + 20 / u, clientY: 100 - 30 / u });
    };
    drag();
    assert.match(notes.at(-1), /Moved from 3, 2/, 'the redraw inside the commit shows the note');
    refuse = true;
    drag();
    assert.equal(keeps['map:view'].note, 'Not now.');
});

test('a tap selects a place; the arrow keys and the X and Y steps move it; Escape lets go', () => {
    const { calls, keeps, draw } = setup();
    let root = draw();
    tap(root, 'fenhold');
    assert.equal(calls.length, 0, 'a tap does not move');
    root = draw();
    assert.match(root.querySelector('.st-mplace').textContent, /Fenhold.*Routes from here · 1.*Reedmoor/);
    placeNode(root, 'fenhold').dispatch('keydown', { key: 'ArrowUp' });
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['content', 'places', 0, 'x'], value: 0 }, { op: 'set', path: ['content', 'places', 0, 'y'], value: 1 }]);
    placeNode(root, 'fenhold').dispatch('keydown', { key: 'ArrowLeft', shiftKey: true });
    assert.deepEqual(calls.at(-1)[0], { op: 'set', path: ['content', 'places', 0, 'x'], value: -10 });
    root.querySelector('.st-mplace [aria-label="X up"]').click();
    assert.deepEqual(calls.at(-1)[0].value, 1);
    placeNode(root, 'fenhold').dispatch('keydown', { key: 'Escape' });
    assert.equal(keeps['map:view'].sel, null);
});

test('Add a route: two taps open the form with a km guess, Add inserts the route, and a second route between the same places needs a name', () => {
    const { calls, keeps, draw, pack } = setup();
    let root = draw();
    root.querySelector('[data-mode="route"]').click();
    root = draw();
    tap(root, 'fenhold');
    tap(root, 'cairn');
    root = draw();
    const form = root.querySelector('.st-mnew');
    assert.match(form.textContent, /From.*Fenhold.*To.*Cairn/);
    assert.match(form.textContent, /Suggested: your routes run about \d+ km a map unit/);
    form.querySelector('select[aria-label="Kind"]').value = 'barge';
    form.querySelector('select[aria-label="Kind"]').dispatch('change', { target: { value: 'barge' } });
    form.querySelector('.st-radd').click();
    const added = calls.at(-1)[0];
    assert.equal(added.op, 'insert');
    assert.deepEqual(added.path, ['content', 'routes', pack.content.routes.length]);
    assert.equal(added.value.from, 'fenhold'); assert.equal(added.value.to, 'cairn'); assert.equal(added.value.kind, 'barge');
    assert.equal(typeof added.value.km, 'number');
    assert.deepEqual(keeps['map:view'].sel, { route: pack.content.routes.length });

    keeps['map:view'].mode = 'route';
    root = draw();
    tap(root, 'reedmoor');
    tap(root, 'fenhold');
    root = draw();
    assert.match(root.querySelector('.st-mnew .st-problem').textContent, /already joins these two places.*Give this one a name/);
    const off = root.querySelector('.st-radd');
    assert.ok(off.disabled === true || off.hasAttribute('disabled'));
    const name = root.querySelector('.st-mnew input[aria-label="Name"]');
    name.value = 'lamp-road'; name.dispatch('change');
    root = draw();
    assert.equal(root.querySelector('.st-mnew .st-problem'), null);
    root.querySelector('.st-radd').click();
    assert.equal(calls.at(-1)[0].value.name, 'lamp-road');
});

test('a tapped route shows its card; Delete asks first, then removes it', () => {
    const { calls, keeps, draw } = setup();
    let root = draw();
    root.querySelector('[data-rt="1"] .ln').dispatch('pointerdown', { clientX: 5, clientY: 5 });
    root.querySelector('.st-mapbox').dispatch('pointerup', { clientX: 5, clientY: 5 });
    root = draw();
    assert.match(root.querySelector('.st-mroute').textContent, /Reedmoor → Cairn.*barge.*96 km/);
    root.querySelector('.st-mroute .st-rdel').click();
    root = draw();
    assert.match(root.querySelector('.st-rconfirm').textContent, /Delete the route Reedmoor → Cairn\?.*Undo brings it back/);
    root.querySelector('.st-rdel-yes').click();
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: ['content', 'routes', 1] }]);
    assert.equal(keeps['map:view'].sel, null);
});

test('Go to a place selects it, on its own layer', () => {
    const { draw, keeps } = setup({ focus: { rec: 'places.3', path: null } });
    const root = draw();
    assert.equal(keeps['map:view'].layer, 'underground');
    assert.match(root.querySelector('.st-mplace').textContent, /Deep Hall/);
});

test('a format 3 pack\'s map only looks: no modes, no steps, and a drag moves nothing', () => {
    const { calls, draw } = setup({ legacy: true });
    const root = draw();
    assert.match(root.querySelector('.st-mro').textContent, /Read-only/);
    assert.equal(root.querySelector('button[data-mode]'), null);
    placeNode(root, 'reedmoor').querySelector('circle.b').dispatch('pointerdown', { clientX: 0, clientY: 0 });
    root.querySelector('.st-mapbox').dispatch('pointermove', { clientX: 90, clientY: 0 });
    root.querySelector('.st-mapbox').dispatch('pointerup', { clientX: 90, clientY: 0 });
    assert.equal(calls.length, 0);
    assert.equal(root.querySelector('.st-steps'), null);
});

test('rendered: the Map segment opens the map, and a drag moves a place in the Studio', async (t) => {
    let chromium;
    try { ({ chromium } = await import('playwright')); } catch (err) { if (process.env.CI === 'true') throw err; t.skip('Playwright unavailable'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch (err) { if (process.env.CI === 'true') throw err; t.skip(`Playwright browser unavailable: ${String(err.message).split('\n')[0]}`); return; }
    const { server, port } = await serve();
    try {
        for (const width of [1280, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const errors = [];
            page.on('pageerror', err => errors.push(err.message));
            await page.goto(`http://127.0.0.1:${port}/studio/index.html`);
            await page.setInputFiles('.st-file', { name: 'pack.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(world())) });
            await page.locator('[data-part="map"]:visible').first().click();
            await page.click('[data-view="map"]');
            await page.waitForSelector('.st-mp [data-pl="reedmoor"]');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `nothing runs sideways at ${width}`);
            const at = await page.locator('.st-mp [data-pl="reedmoor"] circle.b').boundingBox();
            await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
            await page.mouse.down();
            await page.mouse.move(at.x + at.width / 2 + 40, at.y + at.height / 2, { steps: 4 });
            await page.mouse.up();
            await page.waitForSelector('.st-mnote');
            assert.match(await page.textContent('.st-mside'), /Moved from 3, 2/);
            assert.match(await page.textContent('.shd'), /Draft|World/);
            await page.keyboard.press('Control+z');
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {
        await browser.close();
        await new Promise(done => server.close(done));
    }
});
