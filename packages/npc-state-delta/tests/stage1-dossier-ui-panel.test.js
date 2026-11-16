import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dossierDetailProjection } from '../dossier-ui.js';
import { setStoryClockSource } from '../calendar.js';
import { DeltaDossierUi } from '../dossier-ui.js';
import { boardHtml, boardTiles } from '../dossier-ui-board.js';
import { libraryFaceHtml, libraryFootHtml, librarySearchHtml } from '../dossier-ui-library.js';
import { dossierMenuHtml } from '../dossier-ui-header.js';
import { dossierProfileHtml } from '../dossier-ui-profile.js';
import { createScreenState, escapeAction, goBack, layoutFor, openNpc, openSection, parseScreen, screenSignature, setSection, showScreen, stepSection, swipeStep } from '../dossier-ui-screens.js';
import { boardModel } from '../dossier-ui-view-model.js';
import { builtCss, rika, root, stubNode } from './stage1-dossier-ui.helpers.js';

test('screens: back, section arrows, Esc order, swipe, layout and the signature a refresh keeps', () => {
  let state = createScreenState();
  assert.equal(escapeAction(state), 'close', 'the library closes the panel');
  state = openNpc(state, 'rika');
  assert.deepEqual([state.name, state.npcId], ['board', 'rika']);
  state = openSection(state, 2);
  assert.equal(screenSignature(state), 'rika|section:with');
  state = stepSection(stepSection(state, 1), 1);
  assert.equal(state.section, 4);
  state = stepSection(state, 1);
  assert.equal(state.section, 5);
  assert.equal(stepSection(state, 1).section, 5, 'clamped at the last section');
  assert.equal(setSection(state, 0).section, 0);
  assert.equal(escapeAction(state, { blocked: true }), 'none', 'the editor or lightbox keeps Esc');
  assert.equal(escapeAction(state), 'back');
  state = goBack(state);
  assert.equal(state.name, 'board');
  state = goBack(goBack(showScreen(state, 'profile')));
  assert.equal(state.name, 'library');
  assert.equal(goBack(createScreenState()).name, 'library');
  assert.equal(showScreen(createScreenState(), 'board').name, 'library', 'a board needs an NPC');
  assert.deepEqual(parseScreen('section:9'), { name: 'section', section: 0 });
  // saved screens: by id, and the old numbers (0 Right now = Mood and where, 1 With, 2 Ties, 3 Past, 4 Secrets) open the same place
  assert.deepEqual(['section:mood', 'section:now', 'section:with', 'section:ties', 'section:past', 'section:secrets'].map(text => parseScreen(text).section), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4].map(n => parseScreen(`section:${n}`).section), [0, 2, 3, 4, 5]);
  assert.equal(parseScreen(screenSignature(state).split('|')[1]).section, state.section, 'the signature parses back to the same section');
  assert.equal(parseScreen('nonsense').name, 'library');
  assert.equal(swipeStep(-80, 5), 1);
  assert.equal(swipeStep(80, 5), -1);
  assert.equal(swipeStep(60, 90), 0, 'a vertical swipe is a scroll');
  assert.deepEqual(layoutFor(openSection(openNpc(createScreenState(), 'a'), 1)).panes, ['dial', 'board', 'section']);
  assert.deepEqual(layoutFor(openSection(openNpc(createScreenState(), 'a'), 1), { phone: true }).panes, ['section']);
});

test('header menu keeps the classes and data-npc-id the global Edit, Refresh, Scan and Archive handlers find', () => {
  const html = dossierMenuHtml('npc_"x', { archived: false });
  for (const hook of ['delta-edit', 'npc-state-delta-refresh-chat', 'npc-state-delta-scan-dossier', 'delta-experience-portrait', 'delta-experience-diagnostics', 'npc-state-delta-archive-npc']) assert.match(html, new RegExp(hook), hook);
  assert.match(html, /data-npc-id="npc_&quot;x"/, 'the id is escaped');
  assert.match(html, /<summary class="delta-btn">More<\/summary>/);
  assert.match(dossierMenuHtml('a', { archived: true }), /npc-state-delta-restore-npc[^>]*>Restore active/);
  assert.match(dossierMenuHtml('a', { deceased: true }), /Correct death record/);
  assert.equal(dossierMenuHtml(''), '');
});

test('Dossier style: the skin tokens exist for all three looks and the panel root carries data-skin', () => {
  const styles = fs.readFileSync(path.join(root, 'dossier-ui-styles-board.js'), 'utf8');
  const skin = ['look', 'store', 'apply', 'settings'].map(part => fs.readFileSync(path.join(root, 'dossier-skin-parts', `${part}.js`), 'utf8')).join('\n');
  assert.match(styles, /:not\(\[data-skin\]\), \$\{PANEL\}\[data-skin="neutral"\]/, 'Neutral is the default, with or without the attribute');
  assert.match(styles, /\[data-skin="fantasy"\]/);
  assert.match(styles, /\[data-skin="modern"\]/);
  assert.match(skin, /DOSSIER_SKIN_DEFAULT = 'neutral'/);
  assert.match(skin, /element\.dataset\.skin = value/);
  assert.doesNotMatch(styles + skin, /fonts\.googleapis|@import|@font-face/, 'no web font loading');
});

test('the panel walks library, board, section and profile from one projection; a refresh keeps the screen; Esc goes back before it closes', async () => {
  const saved = { document: globalThis.document, CSS: globalThis.CSS };
  globalThis.document = { activeElement: null, createElement: () => ({}), getElementById: () => null };
  globalThis.CSS = { escape: value => value };
  try {
    let token = 't1';
    const state = { npcs: [{ ...rika, key: undefined }, { id: 'b', name: 'Bo' }] };
    const api = { dossierViewStatus: () => ({ chatKey: 'c1', hydrationStatus: 'ready' }), getDossierState: () => state, dossierViewToken: () => token, uiStatus: () => ({}) };
    const ui = new DeltaDossierUi(api);
    const doc = stubNode();
    const list = stubNode();
    doc.querySelector = selector => (selector === '[data-delta-library-list]' ? list : null);
    const slot = stubNode();
    slot.html = '<button class="delta-edit" data-npc-id="rika">Edit</button>';
    const nodes = { '.delta-document': doc, '.delta-stage': stubNode(), '.delta-empty': stubNode(), '.delta-notice': stubNode(), '.delta-chat-state': stubNode(), '.delta-header-slot': slot };
    let rendered = 0;
    ui.root = { querySelector: selector => nodes[selector] ?? null, querySelectorAll: () => [], dispatchEvent: () => { rendered += 1; } };
    ui.panelOpen = true;
    await ui.refresh({ force: true });
    assert.equal(doc.dataset.screen, 'library');
    assert.match(list.html, /data-npc-id="rika"/);
    ui.setScreen(openNpc(ui.screen, 'rika'));
    assert.equal(ui.selectedNpcId, 'rika');
    assert.match(doc.html, /data-screen="board"/);
    ui.setScreen(openSection(ui.screen, 3));
    assert.match(doc.html, /data-delta-section-head="ties"/);
    assert.match(doc.html, /data-pane="board"[\s\S]*data-pane="section"/, 'desktop: the board beside the section');
    token = 't2';
    state.npcs[0] = { ...state.npcs[0], mood: 'calm' };
    await ui.refresh();
    assert.equal(ui.screen.name, 'section', 'a refresh does not reset the screen');
    assert.equal(ui.screen.section, 3);
    ui.setScreen(showScreen(ui.screen, 'profile'));
    assert.match(doc.html, /delta-profile-desktop/);
    assert.equal(ui.goBackOrClose(), 'back');
    assert.equal(ui.screen.name, 'section');
    ui.goBackOrClose();
    ui.goBackOrClose();
    assert.equal(ui.screen.name, 'library');
    ui.close = () => { ui.panelOpen = false; };
    assert.equal(ui.goBackOrClose(), 'close');
    assert.equal(ui.panelOpen, false);
    // A request from outside (a present-cast card) opens that dossier's board after the reset; a dossier that vanishes returns to the library.
    ui.panelOpen = true;
    ui.pendingNpcId = 'b';
    await ui.refresh({ force: true });
    assert.deepEqual([ui.screen.name, ui.selectedNpcId], ['board', 'b']);
    state.npcs = [state.npcs[0]];
    await ui.refresh({ force: true });
    assert.equal(ui.screen.name, 'library');
    assert.ok(rendered > 0);
    // The ⋯ menu is outside the redrawn pane: another chat, or one still loading, leaves none of the old buttons live.
    api.dossierViewStatus = () => ({ chatKey: 'no-chat', hydrationStatus: 'ready' });
    slot.innerHTML = '<button class="delta-edit" data-npc-id="rika">Edit</button>';
    await ui.refresh({ force: true });
    assert.equal(slot.html, '');
    api.dossierViewStatus = () => ({ chatKey: 'c2', hydrationStatus: 'loading' });
    slot.innerHTML = '<button class="delta-edit" data-npc-id="rika">Edit</button>';
    await ui.refresh({ force: true });
    assert.equal(slot.html, '');
  } finally {
    globalThis.document = saved.document;
    globalThis.CSS = saved.CSS;
  }
});

test('the board matches the approved tiles: lead move, place in the title, faces by bond tone, secrets ring with its note', () => {
  const npc = {
    id: 'rika', name: 'Rika', mood: 'alarmed', location: 'Northern Ridge', cast: { doing: 'Crouched at the lip' },
    relationship: { trust: 5, affection: 0, desire: 0, tension: 2 },
    lastRelationshipChange: { impact: 'meaningful', delta: { tension: 2, trust: 0, affection: 0, desire: 0 }, reason: 'praise backfired', turn: 3 },
    keyRelationships: ['Temiwa: friend | kind', 'Bregje: rival | loud'], memories: ['a', 'the basilisk fell'],
    v2Meters: { secrets: [{ state: 'open', title: 'Winter Gate Debt', text: 't', pill: 'Opened' }, { state: 'hidden', opens: 'Opens at Trust 25', width: 55 }] },
  };
  const tiles = boardTiles(boardModel(npc), { userName: 'Astra' });
  const by = title => tiles.find(tile => tile.title.startsWith(title));
  assert.equal(by('With Astra').lead, 'Tension +2');
  assert.equal(by('Right now').title, 'Right now · Northern Ridge', 'the place joins the title when the body is what she is doing');
  assert.equal(by('Past').title, 'Past · 2');
  assert.equal(by('Secrets').note, 'Winter Gate Debt opened · the next opens at Trust 25', 'no doubled "opens"');
  const html = boardHtml(npc, { userName: 'Astra', peers: new Map([['temiwa', 'data:image/png;base64,AAAA']]) });
  assert.match(html, /delta-tile-face-ring" style="--r:var\(--good\)"/);
  assert.match(html, /delta-tile-face-ring" style="--r:var\(--bad\)"/);
  assert.match(html, /delta-board-hero/);
});

test('the library face shows the mood (the dossier status when archived), the foot goes back to the library, the search counts people', () => {
  const face = libraryFaceHtml({ id: 'a', name: 'Aster', bucket: 'active', mood: 'steady', statusLabel: 'In chat', key: true });
  assert.match(face, /★ key · steady/);
  assert.match(libraryFaceHtml({ id: 'b', name: 'Bryn', bucket: 'archived', mood: 'calm', statusLabel: 'Archived' }), /Archived/);
  assert.match(libraryFootHtml(10), /data-delta-screen="library"[^>]*>▸ Dossier library · 10 NPCs/);
  assert.match(librarySearchHtml('', 10), /placeholder="Search 10 people…"/);
});

test('phase 2 UI: mood bars, pull ring, gate wording, tags, redacted lies and secrets, tastes, drives, look note; none without data', async () => {
  const { v2MetersProjection } = await import('../dossier-ui-meters.js');
  const { sectionScreenHtml } = await import('../dossier-ui-sections.js');
  const { dossierProfileHtml } = await import('../dossier-ui-profile.js');
  const meters = v2MetersProjection({
    bars: [], rank: '', next: '', milestones: [], secrets: [],
    mood: { word: 'alarmed · tense', bars: { energy: 5, control: 1, max: 6 }, cause: 'trust dropped: Astra lied' },
    pull: { kind: 'closure', level: 3, days: 2, cause: 'an open thread' },
    notes: {
      lies: [{ hidden: false, to: 'Astra', said: 'I sold nothing', day: 3, caught: { day: 4 } }, { hidden: true, said: 'SECRET WORDS', to: 'Astra', day: 5 }],
      knows: [{ about: 'X', how: 'saw', day: 2, secret: true, hidden: true, text: 'a secret about X · hidden' }, { about: 'Y', how: 'heard', day: 3, text: 'Y owes a debt', secret: false, hidden: false }],
      tastes: [{ sign: '+', item: 'toffee', from: 'barge crews' }, { sign: '-', item: 'paperwork', mirrored: true }],
      ties: [{ name: 'Temiwa', tags: ['ally'] }, { name: 'Vane', tags: ['owes'] }, { name: 'Bregje', tags: [], owedBy: true }],
      drives: [{ label: 'Conflict', strength: 3, word: 'high', note: 'from their description' }, { label: 'Closure', strength: 2, word: 'normal', note: 'ignored when normal' }, { label: 'Belonging', strength: 1, word: 'low', note: 'eased over 2 story moments (alone)' }, { label: 'Honesty', strength: 0, word: 'off', note: '' }], look: { day: 3 },
    },
  });
  const npc = {
    id: 'r', name: 'Rika', mood: 'old', v2Meters: meters, memories: ['m1'],
    relationship: { trust: 1, affection: 0, desire: 0, tension: 0 },
    keyRelationships: ['Temiwa: friend | kind', 'Vane: colleague | covered her', 'Bregje: colleague | clerk'],
    lastRelationshipChange: { impact: 'net', delta: { trust: 0, affection: 0, desire: 0, tension: 2 }, reason: '', hosted: true, message: 3, event: { tier: 'meaningful', held: false, note: '', ask: {}, date: '', gate: 'via praise · 3rd in 2 days · backfired' } },
  };
  const tiles = boardTiles(boardModel(npc), { userName: 'Astra' });
  assert.equal((tiles.find(tile => tile.title === 'Mood').rowsHtml.match(/delta-sheet-meter /g) || []).length, 3, 'the Mood tile has Feeling, Energy and Control');
  assert.equal(tiles.find(tile => tile.title === 'Mood').big, 'old', 'the scanner\'s own word leads (the numbers follow it); the table word shows only when it wrote none');
  assert.equal(boardTiles(boardModel({ ...npc, mood: '' }), { userName: 'Astra' }).find(tile => tile.title === 'Mood').big, 'alarmed · tense');
  assert.equal(tiles.find(tile => tile.title === 'Pull'), undefined, 'the Pull is no card of its own');
  assert.match(tiles.find(tile => tile.title === 'Mood').footHtml, /delta-pull-row[\s\S]*Closure[\s\S]*aria-label="strength 3 of 3"[\s\S]*high · 2 days · an open thread/, 'the Pull is one footer line of the Mood tile, as dots');
  assert.equal(tiles.find(tile => tile.title === 'Mood').ring, undefined, 'no ring on the Mood tile');
  assert.match(boardHtml(npc, { userName: 'Astra' }), /praise, the 3rd time in 2 days, backfired/, 'the gate receipt in the mockup\'s words');
  assert.doesNotMatch(boardHtml(npc, { userName: 'Astra' }), /Reply #3/, 'no stamp line under the change');
  assert.match(boardHtml(npc, { userName: 'Astra' }), /tap the portrait for (?:her|his|their) profile/);
  const ties = sectionScreenHtml('ties', npc);
  assert.match(ties, />Ally</); assert.match(ties, />Owes</); assert.equal(ties.match(/data-tie-type="owes"/g).length, 2, 'a person who owes her is a debt tie too: Owes');
  assert.doesNotMatch(ties, /lie|I sold nothing|Y owes a debt|Knows about/i, 'Ties holds relationships only');
  const withUser = sectionScreenHtml('with', npc);
  assert.match(withUser, /a lie you have not caught/); assert.match(withUser, /I sold nothing/);
  assert.doesNotMatch(withUser + sectionScreenHtml('secrets', npc), /SECRET WORDS|a secret about/);
  assert.ok(withUser.indexOf('Lies told') > withUser.indexOf('delta-sheet-meters') && withUser.indexOf('Lies told') < withUser.indexOf('Recent changes'), 'Lies told sits after the meters and before Recent changes');
  assert.doesNotMatch(withUser + sectionScreenHtml('secrets', npc), /\bday \d/i, 'lies and knows rows never print the raw day counter');
  const secretsHtml = sectionScreenHtml('secrets', npc);
  assert.match(secretsHtml, /Knows about others[\s\S]*Y owes a debt/);
  assert.equal((ties.match(/class="delta-bond"/g) || []).length, 3, 'each tie is one entry');
  assert.match(sectionScreenHtml('mood', npc), /trust dropped: Astra lied/);
  const profile = dossierProfileHtml({ ...dossierDetailProjection({ id: 'r', name: 'Rika' }, {}, {}), v2Meters: meters }, { layout: 'phone' });
  assert.match(profile, /toffee/); assert.match(profile, /Conflict/);
  assert.match(profile, /class="delta-drive" data-level="high"[^]*?<b class="high"><\/b>[^]*?delta-drive-word">high<[^]*?from their description/, 'a high drive: word, right-reaching bar, source note');
  assert.match(profile, /data-level="low"[^]*?<b class="low"><\/b>[^]*?eased over 2 story moments \(alone\)/);
  assert.match(profile, /data-level="off"[^]*?<b class="off"><\/b>/);
  assert.match(profile, /data-level="normal"[^]*?<b class="normal"><\/b>/);
  assert.doesNotMatch(profile, /ignored when normal/, 'a normal drive shows no source note');
  assert.match(profile, /The middle of each bar is normal/); assert.match(profile, /Look locked since it was first seen: it changes only when you edit it or the story changes it/, 'no calendar reading: "first seen", never the raw day');
  assert.doesNotMatch(profile, /day 3\b/);
  setStoryClockSource(() => ({ minutes: 3 * 1440, calendar: { months: [{ name: 'Goldwane', days: 30 }, { name: 'Icewane', days: 30 }], leapYears: false } }));
  try {
    const dated = dossierProfileHtml({ ...dossierDetailProjection({ id: 'r', name: 'Rika' }, {}, {}), v2Meters: meters }, { layout: 'phone' });
    assert.match(dated, /Look locked since Goldwane 4: it changes/, 'the story calendar date, not day 3');
    assert.doesNotMatch(dated, /day 3\b/);
  } finally { setStoryClockSource(null); }
  const bare = { ...npc, v2Meters: v2MetersProjection({ bars: [], secrets: [] }) };
  const none = boardTiles(boardModel(bare), { userName: 'Astra' });
  assert.equal(none.find(tile => tile.title === 'Pull'), undefined, 'no pull tile without data');
  assert.doesNotMatch(sectionScreenHtml('ties', bare), /Lies told|Knows about/);
  assert.doesNotMatch(dossierProfileHtml({ ...dossierDetailProjection({ id: 'r', name: 'Rika' }, {}, {}), v2Meters: bare.v2Meters }, { layout: 'phone' }), /look was set/);
  assert.match(dossierProfileHtml({ ...dossierDetailProjection({ id: 'r', name: 'Rika' }, {}, {}), v2Meters: { ...bare.v2Meters, notesOn: true } }, { layout: 'phone' }), /No tastes yet[\s\S]*<span>Belonging<\/span>[\s\S]*<span>Honesty<\/span>/, 'no data: Tastes keeps its line, Drives the full list');
});

test('the dial\'s no-portrait fallback is small initials in the suite font stack, and the desktop layout fits a narrow panel and sizes to its content', async () => {
  const html = boardHtml({ id: 'm', name: 'Marrit' }, {});
  assert.match(html, /delta-portrait-placeholder[^>]*><span>M<\/span>/);
  const css = await builtCss();
  assert.doesNotMatch(css.match(/dossier-dial-portrait \.delta-portrait-placeholder \{[^}]*\}/)?.[0] || '', /Georgia|serif;|font-size:48px/);
  assert.match(css, /\.delta-board \{ grid-template-columns:clamp\(250px,32%,460px\)/);
  assert.match(css, /@media \(min-width: 1101px\) \{\s*#\$\{ROOT_ID\} \.delta-panel \{ height:auto;/);
});

test('the dossier layout follows its own container width: container queries, one switch line, no window query, bar in the flow', async () => {
  const css = await builtCss();
  const screens = await import('../dossier-ui-screens.js');
  assert.match(css, /container:dsr \/ inline-size/);
  assert.match(css, new RegExp(`@container dsr \\(min-width: ${screens.TWO_PANE_MIN}px\\)`));
  assert.match(css, new RegExp(`@container dsr \\(max-width: ${screens.TWO_PANE_MIN - 0.02}px\\)`));
  assert.equal(screens.THREE_PANE_MIN, screens.PANE_HERO_SLIM_MIN + screens.PANE_TILES_MIN + screens.PANE_SECTION_WIDE_MIN, 'the three-pane line is a sum of the pane minimums');
  assert.equal(screens.TWO_PANE_MIN, screens.PANE_HERO_MIN + screens.PANE_SECTION_MIN);
  assert.match(css, new RegExp(`@container dsr \\(min-width: ${screens.TWO_PANE_MIN}px\\) and \\(max-width: ${screens.THREE_PANE_MIN - 0.02}px\\)`));
  assert.doesNotMatch(css, /@media \((min|max)-width: 65[01]px\)\s*\{\s*#\$\{ROOT_ID\} \.delta-(board|panes|profile|brand|topbar)/);
  assert.doesNotMatch(css, /position:sticky; bottom:0; display:block;/, 'the library bar sits in the flow under the scroll area');
  // the switch reads the panel width, not the window: a 500 px panel in a 2000 px window is narrow, a 700 px one is not
  const panel = width => ({ clientWidth: width });
  assert.equal(screens.isNarrow(panel(500), { innerWidth: 2000 }), true);
  assert.equal(screens.isNarrow(panel(700), { innerWidth: 400 }), false);
  assert.equal(screens.isNarrow(null, { innerWidth: 400 }), true);
  // the name has its own class with resets, so a host theme's heading rules cannot restyle it
  assert.match(boardHtml({ id: 'm', name: 'Marrit' }, {}), /<h3 class="delta-board-title">Marrit<\/h3>/);
  assert.match(css, /\.delta-board-title \{[^}]*border-left:0 !important[^}]*text-align:center !important/);
  assert.match(dossierProfileHtml({ ...dossierDetailProjection({ id: 'r', name: 'Rika' }, {}, {}) }, { layout: 'phone' }), /<h2 class="delta-profile-title">Rika<\/h2>/);
  assert.match(css, /\.delta-header-menu > summary\.delta-btn \{ display:inline-flex; align-items:center; justify-content:center;/);
});
