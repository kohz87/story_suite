// The cast editor's NPC State fields and portrait (ST-CAST2): Level, meters, stages, secrets with gates, Abilities and Keepsakes as patches,
// the "what NPC State seeds" panel, and a portrait added or replaced as install takes it (made smaller over 150 KB, byte for byte under).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/cast.js';
import { fitPicked, portraitGroup } from '../../../studio/edit/cast-portrait.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { PORTRAIT_LIMITS } from '../../../packs/limits.js';
import { fakeImageIo, gif, png, pngOf, webp } from '../../packs/helpers/portraits.js';

const PACK = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const ROOT = ['content', 'cast'];

function open(n, opts = {}) {
    installFakeDom();
    const pack = structuredClone(PACK);
    opts.edit?.(pack);
    const commits = [];
    const keeps = {};
    // `opts.commit(patches, keeps)`: the host's answer (as the Studio's, whose commit draws the page again before it returns)
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: opts.problems ?? [], focus: { rec: `cast.${n}`, path: opts.path ?? null },
        commit: patches => { commits.push(patches); return opts.commit?.(patches, keeps) ?? { ok: true }; }, go: () => {}, keep: id => (keeps[id] ??= {}), setPortrait: () => ({ ok: true }) };
    const draw = () => editSection({ key: 'cast', where: 'content', value: pack.content.cast, count: pack.content.cast.length }, ctx)[0];
    return { pack, commits, draw, keeps };
}
const row = (root, key) => root.querySelector(`[data-key="${key}"]`);
const change = (control, value) => { control.value = value; control.dispatch('change'); };

test('Level, the meter preset and meter values are set at their paths; blank removes, and the last meter out takes meters away', () => {
    const { commits, draw } = open(0, { edit: pack => { pack.content.cast[0].meters = { trust: 10 }; } });
    const page = draw();
    change(row(page, 'level').querySelector('input'), '3');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'level'], value: 3 }]);
    change(row(page, 'meters.trust').querySelector('input'), '25');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'meters', 'trust'], value: 25 }]);
    change(row(page, 'meters.preset').querySelector('select'), 'rival');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'meters', 'preset'], value: 'rival' }]);
    change(row(page, 'meters.trust').querySelector('input'), '');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: [...ROOT, 0, 'meters'] }]);
    const fresh = open(1);
    change(row(fresh.draw(), 'meters.preset').querySelector('select'), 'mentor');
    assert.deepEqual(fresh.commits.at(-1), [{ op: 'set', path: [...ROOT, 1, 'meters'], value: { preset: 'mentor' } }]);
});

test('Add a meter takes a new id at 0, and refuses in words a bad id, a reserved word or one already there', () => {
    const { commits, draw } = open(0, { edit: pack => { pack.content.cast[0].meters = { trust: 10 }; } });
    const page = draw();
    const add = row(page, 'meters+');
    for (const [typed, said] of [['Two Words', /not a meter id/], ['reason', /keeps for itself/], ['trust', /already one of the meters/]]) {
        change(add.querySelector('input'), typed);
        assert.match(add.querySelector('.st-problem').textContent, said);
    }
    assert.equal(commits.length, 0);
    change(add.querySelector('input'), 'respect');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'meters', 'respect'], value: 0 }]);
    assert.equal(add.querySelector('.st-problem'), null);
});

test('stages: add makes the list and opens the new stage; its form sets name, needs read from words, and a milestone that blank removes', () => {
    const none = open(0);
    none.draw().querySelector('.st-stages .addrow button').click();
    assert.deepEqual(none.commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'stages'], value: [{ name: 'New stage', needs: [{ meter: 'trust', at: 20 }], text: '' }] }]);
    assert.equal(none.keeps['cast:cast.0'].open, 'stages.0');

    const stage = { name: 'Wary', needs: [{ meter: 'trust', at: 20 }], text: 'She watches.', milestone: 'first-talk' };
    const { commits, draw, keeps } = open(0, { edit: pack => { pack.content.cast[0].stages = [stage, { ...stage, name: 'Warm' }]; } });
    keeps['cast:cast.0'] = { open: 'stages.1' };
    const page = draw();
    assert.match(page.querySelector('.st-stages .subrow').textContent, /trust 20 · She watches\./);
    const needs = row(page, 'stages.1.needs');
    assert.equal(needs.querySelector('input').value, 'trust 20');
    change(needs.querySelector('input'), 'trust >= 40, affection 20');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'stages', 1, 'needs'], value: [{ meter: 'trust', at: 40 }, { meter: 'affection', at: 20 }] }]);
    const before = commits.length;
    change(needs.querySelector('input'), 'trust lots');
    assert.equal(commits.length, before);
    assert.match(needs.querySelector('.st-problem').textContent, /"trust lots" is not a meter and a value/);
    change(row(page, 'stages.1.milestone').querySelector('input'), '');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: [...ROOT, 0, 'stages', 1, 'milestone'] }]);
    page.querySelector('.st-stages button[aria-label="Move Warm up"]').click();
    assert.deepEqual(commits.at(-1), [{ op: 'move', path: [...ROOT, 0, 'stages', 1], to: 0 }]);
    assert.equal(keeps['cast:cast.0'].open, 'stages.0');
});

test('secrets: Go to a gate opens that secret and marks the gate; the gate is checked as typed and set on change; an old-form secret points to the JSON', () => {
    const secrets = [{ id: 'why-here', gate: 'meter trust >= 20', text: 'She ran.' }, { title: 'Old', text: 'Older.', meter: 'trust', at: 40 }];
    const { commits, draw } = open(0, { path: ['secrets', 0, 'gate'], edit: pack => { pack.content.cast[0].secrets = secrets; } });
    const page = draw();
    const rows = page.querySelectorAll('.st-secrets .subrow');
    assert.match(rows[0].textContent, /why-here/);
    assert.match(rows[0].textContent, /meter trust >= 20/);
    assert.match(rows[1].textContent, /old form · trust 40/);
    const gate = row(page, 'secrets.0.gate').querySelector('textarea');
    assert.ok(gate.classList.contains('st-at'));
    gate.value = 'meter trust >= 30 or nonsense here'; gate.dispatch('input');
    assert.ok(row(page, 'secrets.0.gate').querySelector('.st-problem'));
    change(gate, 'meter trust >= 30');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'secrets', 0, 'gate'], value: 'meter trust >= 30' }]);
    change(row(page, 'secrets.0.writes_fact').querySelector('input'), 'wren-ran');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'secrets', 0, 'writes_fact'], value: 'wren-ran' }]);
    page.querySelector('.st-secrets button[aria-label="Open Old"]').click();
    assert.match(draw().querySelector('[data-open="secrets.1"]').textContent, /old form/);
});

test('a checker problem on a secret shows under its field and marks its row; at 8 secrets Add is off', () => {
    const many = Array.from({ length: 8 }, (_, n) => ({ id: `s${n}`, gate: 'meter trust >= 20', text: 'T.' }));
    const problems = [{ path: 'content.cast[0].secrets[2].text', message: 'secrets[2].text must be plain text.' }];
    const { draw } = open(0, { problems, path: ['secrets', 2, 'text'], edit: pack => { pack.content.cast[0].secrets = many; } });
    const page = draw();
    assert.ok(page.querySelectorAll('.st-secrets .subrow')[2].classList.contains('bad'));
    assert.match(row(page, 'secrets.2.text').querySelector('.st-problem').textContent, /must be plain text/);
    assert.equal(page.querySelector('.st-secrets .addrow button').disabled, true);
});

test('Abilities and Keepsakes: add makes the list, the form sets name and description, and removing the last takes the field away', () => {
    const { commits, draw, keeps } = open(1);
    draw().querySelector('.st-abilities .addrow button').click();
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 1, 'abilities'], value: [{ name: 'New ability', description: '' }] }]);
    const more = open(1, { edit: pack => { pack.content.cast[1].keepsakes = [{ name: 'Oar', description: 'Worn smooth.' }]; } });
    more.keeps['cast:cast.1'] = { open: 'keepsakes.0' };
    const page = more.draw();
    change(row(page, 'keepsakes.0.description').querySelector('textarea'), 'His father\'s.');
    assert.deepEqual(more.commits.at(-1), [{ op: 'set', path: [...ROOT, 1, 'keepsakes', 0, 'description'], value: 'His father\'s.' }]);
    page.querySelector('.st-keepsakes button[aria-label="Remove Oar"]').click();
    assert.deepEqual(more.commits.at(-1), [{ op: 'remove', path: [...ROOT, 1, 'keepsakes'] }]);
    assert.equal(more.keeps['cast:cast.1'].open, null);
    assert.equal(keeps['cast:cast.1'].open, 'abilities.0');
});

test('"What NPC State seeds" runs the game\'s seeding on the entry as written', () => {
    const { draw, keeps } = open(0, { edit: pack => { pack.content.cast[0].level = 4; pack.content.cast[0].keepsakes = [{ name: 'Lamp hook', description: 'Brass.' }]; } });
    const closed = draw();
    assert.equal(closed.querySelector('.st-seedrow'), null);
    closed.querySelector('.st-seedshow').click();
    const rows = draw().querySelectorAll('.st-seedrow');
    const byField = Object.fromEntries(rows.map(item => [item.dataset.field, item.textContent]));
    assert.match(byField.role, /lamplighter/);
    assert.match(byField.level, /4/);
    assert.match(byField.keepsakes, /Lamp hook/);
    assert.equal(keeps['cast:cast.0'].seed, true);
    const nameless = open(1, { edit: pack => { delete pack.content.cast[1].name; } });
    nameless.keeps['cast:cast.1'] = { seed: true };
    assert.match(nameless.draw().querySelector('.st-seed').textContent, /Give this person a name/);
});

test('fitPicked keeps a small picture byte for byte, makes a big one smaller as install does, and refuses what is not a picture or too big', async () => {
    const small = png(2000);
    const kept = await fitPicked(small, null);
    assert.deepEqual([kept.ok, kept.type, kept.bytes === small], [true, 'png', true]);
    const io = fakeImageIo();
    const fit = await fitPicked(pngOf(2400, 1800, PORTRAIT_LIMITS.bytes + 10), io);
    assert.equal(fit.type, 'webp');
    assert.ok(fit.bytes.length <= PORTRAIT_LIMITS.bytes);
    assert.equal(io.calls.closed, 1);
    assert.match((await fitPicked(gif(500), io)).refusal, /not a WebP, PNG or JPEG/);
    assert.match((await fitPicked(png(PORTRAIT_LIMITS.bytes + 10), null)).refusal, /at up to 150 KB/);
    assert.match((await fitPicked(png(PORTRAIT_LIMITS.source + 1), io)).refusal, /at up to 10 MB/);
});

function portraitSetup(person, others = []) {
    installFakeDom();
    const steps = [];
    const commits = [];
    const said = [];
    const list = [person, ...others];
    // ctx.setPortrait is one undo step: the picture, and the field patches and the dropped old picture with it
    const kit = { ctx: { setPortrait: (name, bytes, more = {}) => { steps.push([name, bytes ? bytes.length : null, more.patches ?? [], more.drop ?? null]); return { ok: true }; }, portrait: () => null },
        commit: patches => { commits.push(patches); return { ok: true }; }, tell: text => said.push(text), imageIo: fakeImageIo() };
    const group = portraitGroup(person, [...ROOT, 0], list, kit);
    const pick = async bytes => {
        const input = group.querySelector('input.st-picfile');
        input.files = [{ name: 'pic', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }];
        input.dispatch('change');
        return kit.pending;
    };
    return { group, steps, commits, said, pick };
}

test('a portrait of the same type replaces the picture under its name; another type gets a new name and the old picture goes', async () => {
    const same = portraitSetup({ id: 'wren', name: 'Wren', portrait: 'wren.webp' });
    assert.equal(same.group.querySelector('.st-picadd').textContent, 'Replace');
    assert.equal(await same.pick(webp(900)), 'wren.webp');
    assert.deepEqual([same.steps, same.commits], [[['wren.webp', 900, [], null]], []]);
    const other = portraitSetup({ id: 'wren', name: 'Wren', portrait: 'wren.webp' });
    await other.pick(png(800));
    assert.deepEqual(other.steps, [['wren.png', 800, [{ op: 'set', path: [...ROOT, 0, 'portrait'], value: 'wren.png' }], 'wren.webp']]);
    assert.deepEqual(other.commits, []);
    const twin = portraitSetup({ id: 'wren', name: 'Wren', portrait: 'wren.webp' }, [{ id: 'twin', name: 'Twin', portrait: 'wren.webp' }]);
    await twin.pick(png(800));
    assert.equal(twin.steps[0][3], null);
    const big = portraitSetup({ id: 'tam', name: 'Tam' });
    await big.pick(pngOf(2400, 1800, PORTRAIT_LIMITS.bytes + 10));
    assert.equal(big.steps[0][0], 'tam.webp');
    assert.match(big.said.at(-1), /Made smaller to fit/);
    const bad = portraitSetup({ id: 'tam', name: 'Tam' });
    await bad.pick(gif(400));
    assert.deepEqual([bad.steps, bad.commits], [[], []]);
    assert.match(bad.said.at(-1), /not a WebP, PNG or JPEG/);
});

test('Remove takes the field away, and the picture only when no one else names it; the record page has the portrait group', () => {
    const alone = portraitSetup({ id: 'wren', name: 'Wren', portrait: 'wren.webp' });
    alone.group.querySelector('.st-picdel').click();
    assert.deepEqual([alone.commits, alone.steps], [[], [[null, null, [{ op: 'remove', path: [...ROOT, 0, 'portrait'] }], 'wren.webp']]]);
    const shared = portraitSetup({ id: 'wren', name: 'Wren', portrait: 'wren.webp' }, [{ id: 'twin', name: 'Twin', portrait: 'wren.webp' }]);
    shared.group.querySelector('.st-picdel').click();
    assert.deepEqual(shared.steps, [[null, null, [{ op: 'remove', path: [...ROOT, 0, 'portrait'] }], null]]);
    const page = open(0).draw();
    assert.ok(page.querySelector('.st-portrait'));
    assert.match(page.querySelector('.st-portrait').textContent, /wren\.webp/);
});

test('a stage or secret added, moved or removed sets the open item before the commit draws the page again, and a refusal puts it back', () => {
    const seen = [];
    const stage = { name: 'Wary', needs: [{ meter: 'trust', at: 20 }], text: '' };
    let refuse = false;
    const host = open(0, { edit: pack => { pack.content.cast[0].stages = [stage, { ...stage, name: 'Warm' }]; },
        commit: (patches, keeps) => { seen.push(keeps['cast:cast.0']?.open); return refuse ? { ok: false, refusal: 'No.' } : { ok: true }; } });
    host.draw().querySelector('.st-stages .addrow button').click();
    assert.equal(seen.at(-1), 'stages.2', 'the redraw inside the commit opens the new stage');
    host.keeps['cast:cast.0'].open = 'stages.1';
    host.draw().querySelector('.st-stages button[aria-label="Move Warm up"]').click();
    assert.equal(seen.at(-1), 'stages.0');
    refuse = true;
    host.draw().querySelector('.st-stages .addrow button').click();
    assert.equal(host.keeps['cast:cast.0'].open, 'stages.0', 'a refused add leaves the open stage as it was');
});

test('a secret\'s id is renamed with the gates that name it (learned:<person>/<secret>); a bad id is refused by the field', () => {
    const { commits, draw, keeps } = open(0, { edit: pack => {
        pack.content.cast[0].secrets = [{ id: 'lamp', gate: 'meter trust >= 20', text: 'x' }];
        pack.content.lore[0].gate = `learned:${pack.content.cast[0].id}/lamp`;
    } });
    keeps['cast:cast.0'] = { open: 'secrets.0' };
    const id = PACK.content.cast[0].id;
    change(row(draw(), 'secrets.0.id').querySelector('input'), 'old-lamp');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: [...ROOT, 0, 'secrets', 0, 'id'], value: 'old-lamp' }, { op: 'set', path: ['content', 'lore', 0, 'gate'], value: `learned:${id}/old-lamp` }]);
    const before = commits.length;
    const page = draw();
    change(row(page, 'secrets.0.id').querySelector('input'), 'Not An Id');
    assert.equal(commits.length, before);
    assert.match(row(page, 'secrets.0.id').querySelector('.st-problem').textContent, /is not an id/);
});
