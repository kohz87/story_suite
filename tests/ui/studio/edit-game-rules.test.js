// The Studio's game Rules (you, rpg, pacing): the rank label, level cap, rank bands (only the end is typed, the starts follow), the player rank
// from a tracker, the pull, the tempo and the skill sets; groups for keys the pack lacks, and taking a key out when its last value is cleared.
// Edited packs still pass the game's own pack checker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/game-rules.js';
import { openDoc } from '../../../studio/model/doc.js';
import { apply } from '../../../studio/model/edits.js';
import { validatePack } from '../../../packs/validate.js';

const GAME = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));
// a real tracker (from the Ersveil example), so the checker passes the pack
const TRACKER = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8')).content.dataModules.find(module => module.slug === 'guild-membership');
delete TRACKER.screens; // its screen names the Ersveil pack
const RPG = {
    levelCap: 30,
    ranks: [{ name: 'F', from: 1, to: 9 }, { name: 'E', from: 10, to: 19 }, { name: 'D', from: 20, to: 30 }],
    playerRank: { module: 'guild-membership', field: 'letter', label: 'Guild' },
    pull: { abilities: 3 },
    skillSets: [{ name: 'Recruit', about: 'A new recruit.', skills: [{ name: 'Brace', about: 'Holds the line.', stat: 'VIT' }] }],
};

// A host: the game document, a commit that applies the patches, and a draw of every section the pack has, in the part's order.
function host(extra = {}, more = {}) {
    installFakeDom();
    const content = { ...structuredClone(GAME.content), dataModules: [structuredClone(TRACKER)], ...structuredClone(extra) };
    for (const [key, value] of Object.entries(extra)) if (value === undefined) delete content[key];
    const requires = { ...GAME.requires, capabilities: ['data-modules-v1'] };
    const me = { doc: openDoc({ doc: { ...structuredClone(GAME), requires, content } }), patches: [], kept: {}, problems: [] };
    me.ctx = () => ({ doc: me.doc, kind: 'game', legacy: false, problems: me.problems, focus: null, keep: id => (me.kept[id] ??= {}), go: () => {},
        commit: patches => { me.patches.push(patches); const result = apply(me.doc, patches); if (result.ok) me.doc = result.doc; return result; }, ...more });
    me.draw = () => {
        const c = me.doc.doc.content;
        me.root = document.createElement('div');
        me.root.append(...['you', 'rpg', 'pacing'].filter(key => c[key] !== undefined).flatMap(key => editSection({ key, where: 'content', value: c[key], count: 1 }, me.ctx())));
        return me.root;
    };
    me.content = () => me.doc.doc.content;
    me.check = () => validatePack(me.doc.doc).errors ?? [];
    return me;
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const edit = (input, value) => { input.value = value; input.dispatch('change'); };
const titles = root => root.querySelectorAll('.gt').map(node => node.textContent);

test('the groups follow the mock, whichever of the three keys the pack has', () => {
    const full = host({ you: { rank: { label: 'Guild rank' } }, rpg: RPG, pacing: { tempo: 2 } });
    assert.deepEqual(titles(full.draw()), ['Your rank', 'Levels', 'Player rank', 'People who join', 'Skill sets', 'JSON', 'Pace']);
    assert.equal(field(full.root, 'you.rank.label').querySelector('input').value, 'Guild rank');
    assert.equal(field(full.root, 'pacing.tempo').querySelector('input').value, '2');
    const onlyRpg = host({ rpg: { levelCap: 20 } });
    const root = onlyRpg.draw();
    assert.deepEqual(titles(root), ['Your rank', 'Levels', 'Player rank', 'People who join', 'Pace']);
    assert.equal(root.querySelectorAll('.st-rules').length, 1, 'one section draws the groups of the keys the pack lacks');
    assert.deepEqual(onlyRpg.check(), []);
});

test('a value for a key the pack lacks writes the key; clearing the last value takes it out, unless the part would be empty', () => {
    const me = host({ rpg: { levelCap: 20 } });
    edit(field(me.draw(), 'you.rank.label').querySelector('input'), ' Guild rank ');
    assert.deepEqual(me.patches.at(-1), [{ op: 'set', path: ['content', 'you'], value: { rank: { label: 'Guild rank' } } }]);
    edit(field(me.draw(), 'pacing.tempo').querySelector('input'), '0.5');
    assert.deepEqual(me.content().pacing, { tempo: 0.5 });
    edit(field(me.draw(), 'you.rank.label').querySelector('input'), '');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'you'] }]);
    edit(field(me.draw(), 'rpg.levelCap').querySelector('input'), '');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'rpg'] }]);
    edit(field(me.draw(), 'pacing.tempo').querySelector('input'), '');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'pacing', 'tempo'] }], 'the last key stays, so the part does too');
    assert.deepEqual(me.content().pacing, {});
    assert.deepEqual(me.check(), []);
});

test('bad values are refused under their field: a label with braces or too long, a cap past 99, a tempo past 4', () => {
    const me = host({ you: { rank: { label: 'Guild rank' } }, rpg: { levelCap: 20 }, pacing: { tempo: 1 } });
    const root = me.draw();
    edit(field(root, 'you.rank.label').querySelector('input'), 'Rank {x}');
    assert.equal(field(root, 'you.rank.label').querySelector('.st-problem').textContent, 'No < > { } in it.');
    edit(field(root, 'you.rank.label').querySelector('input'), 'x'.repeat(31));
    assert.equal(field(root, 'you.rank.label').querySelector('.st-problem').textContent, 'At most 30 characters.');
    edit(field(root, 'rpg.levelCap').querySelector('input'), '120');
    assert.equal(field(root, 'rpg.levelCap').querySelector('.st-problem').textContent, 'Level cap must be a whole number from 1 to 99.');
    edit(field(root, 'pacing.tempo').querySelector('input'), '5');
    assert.equal(field(root, 'pacing.tempo').querySelector('.st-problem').textContent, 'Tempo must be a number from 0.25 to 4.');
    assert.equal(me.patches.length, 0);
});

test('ranks: one row each with its start shown; typing an end moves the next start, and an end past the next one is refused', () => {
    const me = host({ rpg: RPG });
    let root = me.draw();
    const rows = root.querySelectorAll('.st-rank');
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(row => row.querySelector('.st-rfrom').textContent), ['1', '10', '20']);
    assert.equal(root.querySelector('.st-rcount').textContent, '3 of 20 · levels 1 to 30, no gap');
    edit(rows[0].querySelector('.st-rto'), '12');
    assert.deepEqual(me.content().rpg.ranks, [{ name: 'F', from: 1, to: 12 }, { name: 'E', from: 13, to: 19 }, { name: 'D', from: 20, to: 30 }]);
    root = me.draw();
    const second = root.querySelectorAll('.st-rank')[1];
    edit(second.querySelector('.st-rto'), '30');
    assert.equal(second.querySelector('.st-problem').textContent, 'It ends at a whole level from 13 to 29, before the next rank ends.');
    edit(second.querySelector('.st-rname'), 'f');
    assert.equal(second.querySelector('.st-problem').textContent, '"f" is already a rank.');
    edit(second.querySelector('.st-rname'), 'Iron');
    assert.equal(me.content().rpg.ranks[1].name, 'Iron');
    assert.deepEqual(me.check(), []);
});

test('ranks: a move swaps the names and keeps the levels; remove closes the gap; add starts after the last and stops at 99', () => {
    const me = host({ rpg: RPG });
    me.draw().querySelectorAll('.st-rank')[0].querySelector('.st-down').click();
    assert.deepEqual(me.content().rpg.ranks.map(band => band.name), ['E', 'F', 'D']);
    assert.deepEqual(me.content().rpg.ranks.map(band => band.to), [9, 19, 30]);
    me.draw().querySelectorAll('.st-rank')[1].querySelector('.st-remove').click();
    assert.deepEqual(me.content().rpg.ranks, [{ name: 'E', from: 1, to: 9 }, { name: 'D', from: 10, to: 30 }]);
    me.draw().querySelector('.st-add').click();
    assert.deepEqual(me.content().rpg.ranks.at(-1), { name: 'Rank 3', from: 31, to: 40 });
    assert.deepEqual(me.check(), []);
    const full = host({ rpg: { ranks: [{ name: 'All', from: 1, to: 99 }] } });
    full.draw().querySelector('.st-add').click();
    assert.equal(full.patches.length, 0);
    assert.equal(full.root.querySelector('.st-rsaid').textContent, 'The last rank already ends at level 99: end it lower first.');
    full.root.querySelector('.st-remove').click();
    assert.deepEqual(full.patches.at(-1), [{ op: 'remove', path: ['content', 'rpg', 'ranks'] }], 'no ranks left; rpg is the only one of the three, so it stays');
    assert.deepEqual(full.check(), []);
});

test('player rank: pick a tracker (its first field filled in), change the label, and (none) takes it out', () => {
    const me = host({ rpg: { levelCap: 20 } });
    let root = me.draw();
    const pick = field(root, 'rpg.playerRank.module').querySelector('select');
    assert.deepEqual(pick.querySelectorAll('option').map(o => o.textContent), ['(none)', 'guild-membership']);
    assert.equal(field(root, 'rpg.playerRank.label'), null);
    edit(pick, 'guild-membership');
    assert.deepEqual(me.content().rpg.playerRank, { module: 'guild-membership', field: 'letter' });
    root = me.draw();
    assert.match(field(root, 'rpg.playerRank.field').textContent, /registered, letter, standing/);
    edit(field(root, 'rpg.playerRank.label').querySelector('input'), 'Guild');
    assert.deepEqual(me.content().rpg.playerRank, { module: 'guild-membership', field: 'letter', label: 'Guild' });
    assert.deepEqual(me.check(), []);
    edit(field(me.draw(), 'rpg.playerRank.module').querySelector('select'), '(none)');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'rpg', 'playerRank'] }]);
});

test('people who join: abilities from 1 to 6, and the stance switch writes false or takes it out', () => {
    const me = host({ rpg: RPG });
    let root = me.draw();
    edit(field(root, 'rpg.pull.abilities').querySelector('input'), '7');
    assert.equal(me.patches.length, 0);
    edit(field(root, 'rpg.pull.abilities').querySelector('input'), '5');
    assert.deepEqual(me.content().rpg.pull, { abilities: 5 });
    field(me.draw(), 'rpg.pull.stance').querySelector('button.sw').click();
    assert.deepEqual(me.content().rpg.pull, { abilities: 5, stance: false });
    field(me.draw(), 'rpg.pull.stance').querySelector('button.sw').click();
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'rpg', 'pull', 'stance'] }]);
    edit(field(me.draw(), 'rpg.pull.abilities').querySelector('input'), '');
    assert.deepEqual(me.patches.at(-1), [{ op: 'remove', path: ['content', 'rpg', 'pull'] }]);
    assert.deepEqual(me.check(), []);
});

test('skill sets are summed up and edited as JSON; fields the form has no row for are named with the section\'s JSON row', () => {
    const me = host({ rpg: { ...RPG, formula: 'v1' } });
    const root = me.draw();
    assert.match(field(root, 'rpg.skillSets').textContent, /Skill sets · 1.*Recruit · 1 skills/);
    assert.equal(root.querySelector('.st-jsonshow').getAttribute('aria-label'), 'Show this skill set list as JSON');
    assert.match(root.textContent, /Also in content\.rpg: formula\. The form has no field for it\./);
});

test('a checker problem shows under its row; a pack that cannot be edited, or a key that is not an object, is read-only', () => {
    const me = host({ rpg: RPG });
    me.problems = [{ path: 'content.rpg.ranks[1].from', message: 'from must be 10.', level: 'error' }, { path: 'content.rpg.levelCap', message: 'cap.', level: 'error' }];
    const root = me.draw();
    assert.equal(root.querySelectorAll('.st-rank')[1].querySelector('.st-problem').textContent, 'from must be 10.');
    assert.equal(field(root, 'rpg.levelCap').querySelector('.st-problem').textContent, 'cap.');
    const legacy = host({ rpg: RPG }, { legacy: true });
    assert.equal(legacy.draw().querySelector('.st-rank'), null);
    installFakeDom();
    const nodes = editSection({ key: 'pacing', where: 'content', value: 2, count: 1 }, { doc: {}, kind: 'game', problems: [], commit: () => ({ ok: true }), keep: () => ({}) });
    assert.equal(nodes[0].querySelector('.st-rules'), null);
});
