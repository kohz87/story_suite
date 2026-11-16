// Story Block's UX pieces (MODULES §F53, §F54, §F57, §F123, §F125) on the real runtime (the testkit host)
// and the fake DOM: Alt+G for the game view, the status strip's switch, the reduced-motion rules, and the reply cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hudOn, isGameViewKey } from '../../../ui/legacy/ui-host.js';
import { THIS_REPLY_ID } from '../../../ui/legacy/reply-cards.js';
import { STRINGS } from '../../../core/strings.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { cssOf } from '../../core/helpers/css-parts.js';
import { HUD_MODULE, WITH_LINES, page } from './ux.helpers.js';

// ---------------------------------------------------------------------------------------------------
// §F53: Alt+G

test('isGameViewKey: Alt+G only', () => {
    assert.equal(isGameViewKey({ altKey: true, code: 'KeyG', key: '©' }), true);
    assert.equal(isGameViewKey({ altKey: true, key: 'G' }), true);
    assert.equal(isGameViewKey({ altKey: true, ctrlKey: true, code: 'KeyG' }), false);
    assert.equal(isGameViewKey({ altKey: true, shiftKey: true, code: 'KeyG' }), false);
    assert.equal(isGameViewKey({ key: 'g' }), false);
    assert.equal(isGameViewKey({ altKey: true, code: 'KeyH', key: 'h' }), false);
});

test('Alt+G opens and closes the game view; the bar button stays and names the key', async () => {
    const { doc, ui } = await page();
    const press = init => {
        const event = { type: 'keydown', altKey: true, code: 'KeyG', key: 'g', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...init };
        for (const entry of [...doc.listeners]) if (entry.type === 'keydown') entry.fn(event);
        return event;
    };
    const button = doc.querySelector('.story-suite-bar-game');
    assert.equal(button.hidden, false);
    assert.equal(button.title, 'Open the game view (Alt+G)');
    assert.equal(button.getAttribute('aria-keyshortcuts'), 'Alt+G');
    const first = press();
    assert.equal(first.defaultPrevented, true);
    assert.equal(ui.mounts.screen.isOpen(), true);
    assert.equal(ui.mounts.screen.current(), 'story-block/home');
    press({ repeat: true });
    assert.equal(ui.mounts.screen.isOpen(), true, 'a held key does not flicker it');
    press();
    assert.equal(ui.mounts.screen.isOpen(), false);
    assert.equal(press({ ctrlKey: true }).defaultPrevented, false);
    assert.equal(ui.mounts.screen.isOpen(), false);
    button.click();
    assert.equal(ui.mounts.screen.isOpen(), true);
    ui.mounts.screen.close();
    const before = doc.listeners.filter(entry => entry.type === 'keydown').length;
    ui.destroy();
    // Alt+G, and the game view's own key tracker (the mount is destroyed with the page now)
    assert.equal(doc.listeners.filter(entry => entry.type === 'keydown').length, before - 4, 'Alt+G, the mount\'s tracker and the Send note\'s two key listeners are unhooked');
    press();
    assert.equal(ui.mounts.screen.isOpen(), false);
});

// ---------------------------------------------------------------------------------------------------
// §F54: the status strip

test('the status strip is on by default; the drawer switch turns it off and keeps the choice', async () => {
    const { doc, host, ui } = await page({ modules: [HUD_MODULE] });
    assert.equal(hudOn({}), true);
    assert.equal(hudOn({ storySuite: { hud: false } }), false);
    assert.equal(ui.hudOn(), true);
    const strip = doc.querySelector('.ss-hud');
    assert.ok(strip, 'drawn above the message box');
    assert.equal(strip.nextElementSibling, doc.querySelector('#send_form'));
    const check = doc.querySelector('.story-suite-hud-toggle input');
    assert.equal(check.checked, true);
    assert.equal(doc.querySelector('.story-suite-hud-toggle span').textContent, STRINGS.drawer.hud);
    check.checked = false;
    check.dispatch('change');
    assert.equal(doc.querySelector('.ss-hud'), null);
    assert.equal(host.ctx.extensionSettings.storySuite.hud, false);
    assert.ok(host.st.settingsSaves > 0);
    ui.refresh();
    assert.equal(doc.querySelector('.ss-hud'), null, 'stays off');
    ui.setHud(true);
    assert.ok(doc.querySelector('.ss-hud'));
    assert.equal(check.checked, true);
});

// ---------------------------------------------------------------------------------------------------
// §F56, §F57

test('the bar and drawer texts come from strings.js', async () => {
    const { doc } = await page();
    assert.equal(doc.querySelector('.story-suite-bar-story .story-suite-label').textContent, STRINGS.bar.story);
    assert.equal(doc.querySelector('.story-suite-bar-game .story-suite-label').textContent, STRINGS.bar.game);
    assert.equal(doc.querySelector('.story-suite-bar-settings .story-suite-label').textContent, STRINGS.bar.suite);
    assert.match(doc.querySelector('.story-suite-drawer .story-suite-muted').textContent, /^Story Suite 2\.0\.0-test · /);
});

test('host.css: subtle transitions, and none under prefers-reduced-motion', () => {
    const css = cssOf('host');
    assert.match(css, /@keyframes story-suite-fade-in/);
    assert.match(css, /\.ss-l-meter-fill \{ transition: width/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.ok(reduced.length > 30, 'a reduced-motion block');
    for (const selector of ['.ss-card', '.ss-hud', '.ss-gameview', '[data-ss-screen] *', '.story-suite-reply-note', '.ss-send-note', '.rpg-fight-offer', '.rpg-fight-pause']) assert.ok(reduced.includes(selector), selector);
    assert.match(reduced, /transition: none !important;/);
    assert.match(reduced, /animation: none !important;/);
});

// ---------------------------------------------------------------------------------------------------
// §F125: a module's own lines on the changes card (hooks.replyCard)

const ROLL_MODULE = {
    id: 'roll-test', name: 'Roll test', version: '0.0.1',
    domains: { rolls: { initial: () => ({ log: {} }), validate: () => [] } },
    capture: {
        kinds: { toss: { grammar: '? toss <what> | die: N' } },
        apply(ctx, line) {
            const draft = ctx.draft('rolls');
            const id = `rl_${String(Object.keys(draft.log).length + 1).padStart(8, '0')}`;
            draft.log[id] = { key: id, what: line.name, die: Number(line.labels?.die ?? 0) };
            return { summary: 'rolled', narrate: false };
        },
    },
    hooks: {
        // The reply's own rolls: the log entries its ops touched, read from the reply's state.
        replyCard({ state, changes }) {
            const ids = new Set(changes.map(path => /^\/domains\/rolls\/log\/([^/]+)/.exec(path)?.[1]).filter(Boolean));
            return [...ids].map(id => state.domains.rolls.log[id]).filter(Boolean)
                .map(entry => ({ text: `${entry.what}: d20 ${entry.die}`, summary: `${entry.what} ${entry.die}`, icon: 'fa-dice-d20' }));
        },
    },
};

test('the changes card shows a module\'s lines for that reply (summary and body); a swipe shows the new swipe\'s', async () => {
    const { doc, host, ui, draw } = await page({ modules: [ROLL_MODULE] });
    await host.send('hi', 'You climb.\n<Changes>\n? toss climb | die: 14\n</Changes>');
    await host.send('more', 'You rest.');
    draw();
    const cardAt = index => {
        ui.mounts.card.refresh(index, { force: true });
        return doc.querySelector(`.mes[mesid="${index}"] [data-ss-card="${THIS_REPLY_ID}"]`);
    };
    assert.equal(cardAt(2).querySelector('.ss-card-summary').textContent, 'climb 14');
    ui.mounts.card.toggle(2, true);
    assert.equal(cardAt(2).querySelector('.extra .main').textContent, 'climb: d20 14');
    assert.equal(cardAt(2).querySelector('.none'), null);
    // The later reply rolled nothing: its card says so, with no module line.
    assert.equal(cardAt(4).querySelector('.ss-card-summary').textContent, 'No changes');
    await host.swipe('You rest again.\n<Changes>\n? toss rest | die: 3\n</Changes>');
    draw();
    assert.equal(cardAt(4).querySelector('.ss-card-summary').textContent, 'rest 3');
    assert.equal(cardAt(2).querySelector('.ss-card-summary').textContent, 'climb 14', 'the earlier reply keeps its own');
});

// ---------------------------------------------------------------------------------------------------
// §F123: the safety net's lines on the card (final live check FL-3: the folded card said "No item, coin or
// place changes" while its body held "! time +20m (assist)", so the reader never saw the mark)

test('the changes card\'s folded header counts the lines the safety net applied, and its body lists them marked (assist)', async () => {
    // The live path: a reply with no block, the model's answer in plain lines (no <Changes> tags).
    const { doc, host, ui, draw } = await page({ callModel: async () => '~ weather fog\n+ present Fenna' });
    await host.send('hi', WITH_LINES);
    host.features.set(CORE_FEATURE.extractor, true);
    await host.send('We wait by the weir.', 'Fog rolls in and Fenna comes to wait with you.');
    await new Promise(resolve => setTimeout(resolve, 50));
    draw();
    const cardAt = index => {
        ui.mounts.card.refresh(index, { force: true });
        return doc.querySelector(`.mes[mesid="${index}"] [data-ss-card="${THIS_REPLY_ID}"]`);
    };
    const summary = cardAt(4).querySelector('.ss-card-summary').textContent;
    assert.match(summary, /Fenna arrived/, 'the arrival, as any change');
    assert.match(summary, /2 lines from the safety net \(assist\)$/, summary);
    ui.mounts.card.toggle(4, true);
    const listed = [...cardAt(4).querySelectorAll('.assisted .line')].map(line => line.textContent.replace(/\s+/g, ' ').trim());
    assert.deepEqual(listed, ['~ weather fog (assist)', '+ present Fenna (assist)']);
    // The reply before it (the safety net was off) has no mark in its header.
    assert.doesNotMatch(cardAt(2).querySelector('.ss-card-summary').textContent, /safety net/);
});

// ---------------------------------------------------------------------------------------------------
// One card under a reply: another module's card is a section of "This reply", headed by its own title, with its own part of the line

const STATUS_MODULE = {
    id: 'status-test', name: 'Status test', version: '0.0.1',
    queries: { 'clock.text': () => '1:30 pm' },
    screens: [{
        id: 'status-test/card', title: 'Where things stand', icon: 'fa-compass', mounts: ['card'], defaultOn: true,
        template: '<p class="stat">{{ state.scene.place.name }}</p>',
        data: { clock: { query: 'clock.text' } },
        summary: '{{ q.clock }}, {{ state.scene.place.name }}',
    }],
};

test('"This reply" holds the changes and another module\'s card as sections: one line closed, its own title as the heading open', async () => {
    const { doc, host, ui, draw } = await page({ modules: [STATUS_MODULE] });
    await host.send('hi', 'You reach the village.\n<Changes>\n+ item Rope | qty: 1\n~ place Bluewatch Village\n</Changes>');
    draw();
    ui.mounts.card.refresh(2, { force: true });
    const cards = doc.querySelectorAll('.mes[mesid="2"] [data-ss-card]');
    assert.equal(cards.length, 1, 'one card under the reply');
    const card = cards[0];
    assert.equal(card.getAttribute('data-ss-card'), THIS_REPLY_ID);
    assert.equal(card.querySelector('.ss-card-title').textContent, 'This reply');
    const line = card.querySelector('.ss-card-summary').textContent;
    assert.match(line, /^\+1 Rope · .*Bluewatch Village.* · 1:30 pm, Bluewatch Village$/, line);
    assert.doesNotMatch(line, /edit/, 'no edits part in the closed line');
    assert.equal(card.querySelector('.ss-card-summary').getAttribute('title'), line);
    ui.mounts.card.toggle(2, true);
    assert.deepEqual(card.querySelectorAll('.ss-card-sec').map(node => node.getAttribute('data-ss-section')), ['story-block/changes-card', 'status-test/card']);
    assert.deepEqual(card.querySelectorAll('.ss-card-sec-title').map(node => node.textContent), ['Changed this reply', 'Where things stand']);
    assert.equal(card.querySelector('.stat').textContent, 'Bluewatch Village', 'the card keeps its own layout');
});

test('"This reply": a card\'s own switch takes its section and its words away; "Cards under replies" off takes the card away', async () => {
    const { doc, host, ui, draw } = await page({ modules: [STATUS_MODULE] });
    await host.send('hi', 'You reach the village.\n<Changes>\n~ place Bluewatch Village\n</Changes>');
    draw();
    const cardAt = () => {
        ui.mounts.card.refresh(2, { force: true });
        return doc.querySelector(`.mes[mesid="2"] [data-ss-card="${THIS_REPLY_ID}"]`);
    };
    ui.screens.setCards('status-test/card', false);
    const only = cardAt();
    assert.ok(only, 'still "This reply" with one card on');
    assert.equal(only.querySelectorAll('.ss-card-sec').length, 1);
    assert.doesNotMatch(only.querySelector('.ss-card-summary').textContent, /1:30 pm/);
    ui.screens.setCards('status-test/card', true);
    assert.match(cardAt().querySelector('.ss-card-summary').textContent, /1:30 pm/);
    host.features.set(CORE_FEATURE.cards, false);
    assert.equal(cardAt(), null, 'Cards under replies off hides it all');
    host.features.set(CORE_FEATURE.cards, true);
    assert.ok(cardAt());
});
