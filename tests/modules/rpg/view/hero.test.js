// The RPG in the game view's header (lean-rpg/view/hero-data.js, ui-host.js heroOf): with the feature on, the reader's own
// character's Health, Mana, Stamina and experience are the header's bars (they were only on the Party and Fight tabs: the header
// reads its pools from a party module's `party.pc`, which the RPG does not have). Off means off: no RPG, no bars.
import test from 'node:test';
import assert from 'node:assert/strict';
import { heroLead } from '../../../../modules/rpg/view/hero-data.js';
import { gameHeroProps } from '../../../../ui/legacy/view/game-header.js';
import { characterDefinition, fakeState, roleOf, skillsDefinition } from './helpers.js';
import { begin, fieldsOf, makeBlocks, page, settle } from './page.js';

const wessel = { definition: characterDefinition('wessel', 'Wessel'), fields: { health: 3, mana: 4, stamina: 1, level: 2, xp: 40 } };
const ren = { definition: characterDefinition('ren', 'Ren'), fields: { health: 5, mana: 2, stamina: 3, xp: 85 } };
const state = () => fakeState([ren, wessel, { definition: skillsDefinition('wessel-skills', 'Wessel'), fields: {} }]);

test('no lead when no character is the reader\'s (a companion\'s bars are not the reader\'s), or none has been made, or the role is unknown', () => {
    assert.equal(heroLead(state(), { own: 'Nobody', roleOf }), null);
    assert.equal(heroLead(state(), { own: '', roleOf }), null);
    assert.equal(heroLead(fakeState([]), { own: 'Wessel', roleOf }), null);
    assert.equal(heroLead(state(), { own: 'Wessel', roleOf: () => null }), null);
    const left = { definition: characterDefinition('wessel', 'Wessel'), fields: { left: true } };
    assert.equal(heroLead(fakeState([left]), { own: 'Wessel', roleOf }), null, 'a character who left the party');
});

test('feature off: the blocks are only data, the header has no bars; on again they are back', async t => {
    const { doc, host, ui } = await page(t, { feature: false, persona: 'Wessel' });
    await begin(host);
    await makeBlocks(host, { who: 'Wessel' });
    ui.mounts.screen.open();
    await settle();
    assert.equal(doc.querySelector('.ss-gameview-hero .ss-hero-vitals').hidden, true, 'no RPG: no vitals');
    assert.equal(doc.querySelectorAll('.ss-gameview-hero .ss-bar').length, 0);
    host.features.set('story-block.rpg', true);
    await settle();
    ui.mounts.screen.update();
    assert.equal(doc.querySelector('.ss-gameview-hero .ss-hero-vitals').hidden, false, 'the RPG on: the bars come back');
    host.features.set('story-block.rpg', false);
    await settle();
    ui.mounts.screen.update();
    assert.equal(doc.querySelector('.ss-gameview-hero .ss-hero-vitals').hidden, true);
});

test('a character who is not the reader\'s gets no bars in the header', async t => {
    const { doc, host, ui } = await page(t, { persona: 'Mira' });
    await begin(host);
    await makeBlocks(host, { who: 'Wessel' });
    ui.mounts.screen.open();
    await settle();
    assert.equal(doc.querySelector('.ss-gameview-hero .ss-hero-vitals').hidden, true);
});
