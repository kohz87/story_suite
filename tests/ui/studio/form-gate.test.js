// The gate builder (ST-FORM3, mock MK-8): ways of chips, a problem on its chip, remove and undo a way, the add and change sheets, can't-read terms,
// and the text mode that keeps the old checked text box.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { gateField } from '../../../studio/form/gate.js';

const WORLD = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
const C = WORLD.content;
const CARGO = 'meter trust >= 55 or learned:hush/the-runaways or place:vargate and meter trust >= 30';

function field(value, extra = {}) {
    installFakeDom();
    const got = [];
    const row = gateField({ key: extra.key ?? 'gate', label: 'Gate', hint: 'Terms joined by or / and', value, content: C, ownerId: extra.owner ?? null }, (key, text) => got.push(text));
    return { row, got };
}
const ways = row => row.querySelectorAll('.st-way');
const chips = (row, way = 0) => ways(row)[way].querySelectorAll('.st-term');
const sheet = () => globalThis.document.querySelector('.sh-ov');
const pick = (label, value) => { const box = sheet().querySelector(`[data-field="${label}"] select`); box.value = value; box.dispatch('change'); };
const kind = name => sheet().querySelector(`.slist button[data-kind="${name}"]`).click();
const ok = () => sheet().querySelector('.st-gok');

test('a gate is drawn as ways of chips with their kind and names, "and" between terms, and the gate as text', () => {
    const { row } = field(CARGO, { owner: 'nerissa', key: 'cargo' });
    assert.equal(ways(row).length, 3);
    assert.equal(row.querySelectorAll('.st-or').length, 2);
    assert.deepEqual(chips(row, 0).map(c => c.querySelector('.st-tag').textContent), ['meter']);
    assert.equal(chips(row, 0)[0].querySelector('.st-chip span').textContent, 'Trust ≥ 55');
    assert.match(chips(row, 1)[0].textContent, /learned.*Hush · the-runaways/);
    assert.deepEqual(chips(row, 2).map(c => c.querySelector('.st-tag').textContent), ['at', 'meter']);
    assert.equal(chips(row, 2)[0].querySelector('.st-chip span').textContent, 'Vargate');
    assert.equal(ways(row)[2].querySelector('.st-and').textContent, 'and');
    assert.equal(row.querySelector('.st-astext code').textContent, CARGO);
    assert.equal(row.querySelector('.st-problem'), null);
    assert.equal(row.querySelector('.st-ok').textContent, '✓ The game takes this gate.');
    assert.equal(row.querySelector('textarea').hidden, true, 'the text box stays in the row, hidden while the builder shows');
});

test('a bad term shows its problem on its chip and under its way; the row says where it is', () => {
    const { row } = field('place:holy-city-of-aurelion-silent-cloisters or learned:livia/the-old-cadance', { key: 'bad' });
    const bad = chips(row, 1)[0];
    assert.equal(bad.dataset.level, 'error');
    assert.equal(chips(row, 0)[0].dataset.level, '');
    assert.match(ways(row)[1].querySelector('.st-termbad').textContent, /^✕ .*the-old-cadance/);
    assert.equal(row.querySelector('.st-problem').textContent, '✕ 1 problem, on the chip above.');
    assert.equal(row.querySelector('textarea').getAttribute('aria-invalid'), 'true');
});

test('× takes a term out; taking the last term of a way takes the way out, with an Undo', () => {
    const { row, got } = field(CARGO, { owner: 'nerissa', key: 'remove' });
    chips(row, 2)[1].querySelector('.st-x').click();
    assert.equal(got.at(-1), 'meter trust >= 55 or learned:hush/the-runaways or place:vargate');
    chips(row, 1)[0].querySelector('.st-x').click();
    assert.equal(got.at(-1), 'meter trust >= 55 or place:vargate');
    assert.equal(ways(row).length, 2);
    assert.match(row.querySelector('.st-gnote').textContent, /^Way 2 removed\. Undo$/);
    const again = gateField({ key: 'remove', label: 'Gate', value: got.at(-1), content: C, ownerId: 'nerissa' }, (key, text) => got.push(text));
    assert.ok(again.querySelector('.st-gnote'), 'the note outlives the editor drawing the row again');
    again.querySelector('.st-undo-way').click();
    assert.equal(got.at(-1), 'meter trust >= 55 or learned:hush/the-runaways or place:vargate');
    assert.equal(again.querySelector('.st-gnote'), null);
});

test('"+ and" opens the kinds; Fired asks for an event, shows the term as text, and Add puts it in that way', () => {
    const { row, got } = field('fact:iron-archive-opened', { key: 'add' });
    ways(row)[0].querySelector('.st-and-add').click();
    assert.match(sheet().querySelector('.sh-h h3').textContent, /^Add to way 1: what must hold\?$/);
    assert.deepEqual(sheet().querySelectorAll('.secl2').map(n => n.textContent), ['Story', 'People', 'Place and words']);
    kind('fired');
    assert.equal(sheet().querySelector('.sh-h h3').textContent, 'Fired: an event happened');
    sheet().querySelector('.sh-h .st-gback').click();
    assert.equal(sheet().querySelector('.sh-h .st-gback'), null);
    kind('fired');
    assert.equal(ok().disabled, true, 'nothing to add until an event is picked');
    pick('Event', C.worldEvents[0].id);
    assert.equal(sheet().querySelector('.st-gtext').textContent, `fired:${C.worldEvents[0].id}`);
    ok().click();
    assert.equal(got.at(-1), `fact:iron-archive-opened and fired:${C.worldEvents[0].id}`);
    assert.equal(sheet(), null);
});

test('"+ or" with Set: a condition, then anywhere or in one region of its scope', () => {
    const { row, got } = field('fact:iron-archive-opened', { key: 'or' });
    row.querySelector('.st-or-add').click();
    assert.match(sheet().querySelector('.sh-h h3').textContent, /way 2/);
    kind('set');
    pick('Condition', 'harvest-failed');
    assert.equal(sheet().querySelector('.st-gtext').textContent, 'set:harvest-failed');
    sheet().querySelector('[data-field="Where"] button[aria-pressed="false"]').click();
    assert.equal(ok().disabled, true);
    pick('Region', 'highmark-empire');
    ok().click();
    assert.equal(got.at(-1), 'fact:iron-archive-opened or set:harvest-failed@highmark-empire');
});

test('a chip opens "Change a term": Done keeps the change, Remove takes it out, Cancel leaves it', () => {
    const { row, got } = field(CARGO, { owner: 'nerissa', key: 'change' });
    chips(row, 2)[1].querySelector('.st-chip').click();
    assert.equal(sheet().querySelector('.sh-h h3').textContent, 'Change a term: meter');
    const at = sheet().querySelector('[data-field="At least"] input');
    at.value = '40'; at.dispatch('change');
    sheet().querySelector('.st-gok').click();
    assert.equal(got.at(-1), 'meter trust >= 55 or learned:hush/the-runaways or place:vargate and meter trust >= 40');
    chips(row, 0)[0].querySelector('.st-chip').click();
    sheet().querySelector('.st-gcancel').click();
    assert.equal(got.length, 1);
    chips(row, 2)[0].querySelector('.st-chip').click();
    sheet().querySelector('.st-gdel').click();
    assert.equal(got.at(-1), 'meter trust >= 55 or learned:hush/the-runaways or meter trust >= 40');
});

test('in a lore gate a meter and a stage name the person; in a secret they are the owner\'s', () => {
    const lore = field('', { key: 'lore-meter' });
    lore.row.querySelector('.st-first').click();
    kind('meter');
    assert.equal(ok().disabled, true, 'a lore gate\'s meter needs its person');
    pick('Person', 'temiwa');
    pick('Meter', 'affection');
    ok().click();
    assert.equal(lore.got.at(-1), 'meter affection of temiwa >= 30');
    assert.equal(chips(lore.row, 0)[0].querySelector('.st-chip span').textContent, 'Sister Temiwa\'s affection ≥ 30');
    const secret = field('', { key: 'secret-stage', owner: 'temiwa' });
    secret.row.querySelector('.st-first').click();
    kind('stage');
    assert.equal(sheet().querySelector('[data-field="Person"]'), null);
    pick('Stage', 'Burns a candle for you');
    ok().click();
    assert.equal(secret.got.at(-1), 'stage >= "Burns a candle for you"');
});

test('Learned picks whose, then the secret or the hidden lore entry', () => {
    const { row, got } = field('', { key: 'learned' });
    row.querySelector('.st-first').click();
    kind('learned');
    pick('Whose', 'temiwa');
    pick('Secret', 'the-page');
    ok().click();
    assert.equal(got.at(-1), 'learned:temiwa/the-page');
    row.querySelector('.st-or-add').click();
    kind('learned');
    pick('Whose', 'lore');
    const hidden = C.lore.find(entry => entry.hidden === true && entry.id);
    pick('Entry', hidden.id);
    ok().click();
    assert.equal(got.at(-1), `learned:temiwa/the-page or learned:lore/${hidden.id}`);
});

test('a term the builder cannot read is kept as written on a "can\'t read" chip; Fix it as text opens the text box', () => {
    const { row, got } = field('fact:last-rite-proof or stage of temiwa >= Burns a candle', { key: 'raw' });
    const raw = chips(row, 1)[0];
    assert.equal(raw.querySelector('.st-tag').textContent, 'can\'t read');
    assert.equal(raw.dataset.level, 'error');
    assert.match(ways(row)[1].querySelector('.st-termbad').textContent, /The builder can't read this term\./);
    chips(row, 0)[0].querySelector('.st-x').click();
    assert.equal(got.at(-1), 'stage of temiwa >= Burns a candle', 'the unread term is written back as it was');
    ways(row)[0].querySelector('.st-fix').click();
    assert.equal(row.querySelector('textarea').hidden, false);
    row.querySelector('.st-tobuilder').click();
});

test('Edit as text shows the checked text box, which commits as typed, and stays until Back to the builder', () => {
    const { row, got } = field('fact:iron-archive-opened', { key: 'text' });
    row.querySelector('.st-totext').click();
    const area = row.querySelector('textarea');
    assert.equal(area.hidden, false);
    assert.equal(row.querySelector('.lb small').textContent, 'Terms joined by or / and');
    area.value = 'fired:nothing-like-this'; area.dispatch('input');
    assert.match(row.querySelector('.st-problem').textContent, /not an event/);
    area.value = 'fact:iron-archive-opened or fact:veil-in-archive'; area.dispatch('change');
    assert.equal(got.at(-1), 'fact:iron-archive-opened or fact:veil-in-archive');
    assert.equal(row.querySelector('.st-ok').textContent, '✓ The game takes this gate.');
    const redrawn = gateField({ key: 'text', label: 'Gate', value: got.at(-1), content: C }, () => {});
    assert.equal(redrawn.querySelector('textarea').hidden, false, 'the text mode outlives a redraw');
    redrawn.querySelector('.st-tobuilder').click();
    assert.equal(redrawn.querySelectorAll('.st-way').length, 2);
});

test('an empty gate offers the first term or the text box', () => {
    const { row } = field('', { key: 'empty' });
    assert.equal(row.querySelector('.st-empty .none').textContent, 'No terms yet');
    assert.ok(row.querySelector('.st-first'));
    assert.equal(row.querySelector('.st-problem'), null);
    assert.equal(row.querySelector('.st-astext'), null);
    row.querySelector('.st-totext').click();
    assert.equal(row.querySelector('textarea').hidden, false);
    row.querySelector('.st-tobuilder').click();
});
