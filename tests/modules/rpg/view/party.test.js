import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { createPartyScreen, createPartyWidget, PARTY_SCREEN_ID, PARTY_WIDGET } from '../../../../modules/rpg/view/party.js';
import { hasCharacters, readParty, stageTone, stageWord } from '../../../../modules/rpg/view/party-data.js';
import { activeNow } from '../../../../ui/legacy/view/mounts/common.js';
import { characterDefinition, fakeState, foesDefinition, roleOf, skillsDefinition } from './helpers.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';

const wessel = { definition: characterDefinition('wessel', 'Wessel'), fields: { health: 3, mana: 4, stamina: 1, str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10, points: 3, level: 2, xp: 40 } };
const ren = { definition: characterDefinition('ren', 'Ren'), fields: { health: 5, mana: 2, stamina: 3, str: 7, vit: 9, agi: 10, dex: 11, int: 15, luk: 10, cha: 12, level: 1, xp: 85 } };
const skills = { definition: skillsDefinition('wessel-skills', 'Wessel', { tab: true, card: false, tabName: 'Skills', icon: 'ph-star' }), fields: { skill1: 'Iron Breath', rank1: 2, skill2: 'Short blade', rank2: 0 } };
const party = () => fakeState([ren, wessel, skills]);

function draw(state, { api = {}, own = 'Wessel', openWizard = null } = {}) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const widget = createPartyWidget({ headState: () => state, readerName: () => own, roleOf, openWizard });
    const handle = widget.render(el, {}, api);
    return { doc, el, handle, widget };
}
const buttons = (root, text) => root.querySelectorAll('button').filter(node => node.textContent === text);
const card = (el, name) => el.querySelector(`.rpg-card[data-character="${name}"]`);

test('the Party screen is a tab and a screen that is on whenever the feature is, so a story with no character can make one', () => {
    const screen = createPartyScreen();
    assert.equal(screen.id, PARTY_SCREEN_ID);
    assert.deepEqual(screen.mounts, ['screen', 'tab']);
    for (const state of [party(), fakeState([{ definition: foesDefinition() }]), null]) assert.equal(activeNow(screen, state, () => null).on, true);
    assert.equal(hasCharacters(fakeState([skills]), { roleOf }), false, 'a Skills block alone is still no party');
    assert.equal(hasCharacters(party(), { roleOf }), true);
});

test('without a command the bars are plain: no pencil', () => {
    const { el } = draw(party());
    assert.equal(el.querySelectorAll('.ss-w-editable-pencil').length, 0);
});

test('the widget is named rpg.party and the screen draws it', () => {
    assert.equal(PARTY_WIDGET, 'rpg.party');
    assert.match(createPartyScreen().template, /rpg\.party/);
});

test('the stylesheet: cards side by side on a wide screen, stacked on a phone, theme tokens only, nothing fixed', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-cards \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 300px\), 1fr\)\)/);
    assert.doesNotMatch(css, /position:\s*fixed/);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, 'no colour of its own');
    assert.doesNotMatch(css, /\brgba?\(/);
    assert.match(css, /@container \(min-width: 700px\)/);
    assert.match(css, /@media \(max-width: 600px\)/);
});

test('Long names in the left row are cut with an ellipsis', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-main \{[^}]*grid-template-columns: minmax\(0, 1fr\)/, 'the one column may shrink below its content');
    assert.match(css, /\.rpg-left-fold \{[^}]*min-width: 0[^}]*overflow: hidden/);
    assert.match(css, /\.rpg-left-fold b \{[^}]*white-space: nowrap[^}]*flex: none/);
    assert.match(css, /\.rpg-left-names \{[^}]*min-width: 0[^}]*overflow: hidden[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/);
    assert.match(css, /\.rpg-left-chev \{[^}]*flex: none/);
});
