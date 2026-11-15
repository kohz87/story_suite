import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dossierDetailProjection, DeltaDossierUi } from '../dossier-ui.js';
import { dossierUiSource } from './helpers/dossier-ui-source.js';
import { boardHtml, boardTiles } from '../dossier-ui-board.js';
import { dialArcs, dialSvg } from '../dossier-ui-dial.js';
import { v2MetersProjection } from '../dossier-ui-meters.js';
import { dossierProfileHtml } from '../dossier-ui-profile.js';
import { goBack, openNpc, openSection } from '../dossier-ui-screens.js';
import { sectionScreenHtml } from '../dossier-ui-sections.js';
import { builtCss, rika } from './stage1-dossier-ui.helpers.js';

test('fix 3: two-letter initials, mood bars in Right now, flat profile rows in the mockup order, count bar on the library, no debug wording', async () => {
  const { initialsOf, portraitHtml } = await import('../dossier-ui-html.js');
  assert.equal(initialsOf('The inspector'), 'TI');
  assert.equal(initialsOf('Marrit'), 'M');
  assert.match(portraitHtml({ name: 'Sister Temiwa' }, 'x'), /<span>ST<\/span>/);
  const now = sectionScreenHtml('mood', { id: 'n', name: 'Marrit', mood: 'Cautious' });
  assert.match(now, /<dt>Mood<\/dt><dd><b>Cautious<\/b><\/dd>[\s\S]*delta-mood-rows[\s\S]*Feeling[\s\S]*Energy[\s\S]*Control/, 'Mood: the word and the three rows, at rest as well');
  assert.match(sectionScreenHtml('mood', { id: 'n', name: 'Marrit' }), /<dt>Mood<\/dt><dd><b>[^<]+<\/b><\/dd>[\s\S]*delta-mood-rows/, 'also with no mood word at all');
  const npc = { ...dossierDetailProjection({ id: 'r', name: 'Rika' }, {}, {}), appearanceModel: { overallAppearance: 'Freckled', appearanceForms: [{ name: 'Mage', appearance: 'Singed coat' }], currentForm: 'Mage' }, mannerisms: ['Ties off bandages'], personality: 'Proud', background: 'Frostbite', birthdaySource: 'generated' };
  const html = dossierProfileHtml(npc, { layout: 'desktop' });
  assert.match(html, /<dt>Look<\/dt><dd>Freckled<\/dd><dt>Wearing<\/dt><dd>Singed coat<\/dd><dt>Habits<\/dt><dd>Ties off bandages<\/dd>/);
  assert.ok(html.indexOf('data-delta-profile="identity"') < html.indexOf('data-delta-profile="appearance"') && html.indexOf('data-delta-profile="appearance"') < html.indexOf('data-delta-profile="character"') && html.indexOf('data-delta-profile="character"') < html.indexOf('data-delta-profile="background"'), 'Identity, Appearance, Character, ..., Background');
  assert.doesNotMatch(html, /delta-profile-col"|Deterministic fallback|Physical features/);
  const { libraryCountHtml } = await import('../dossier-ui-library.js');
  assert.match(libraryCountHtml(10), /data-static="true">▸ Dossier library · 10 NPCs</);
  assert.doesNotMatch(libraryCountHtml(10), /data-delta-screen/, 'on the library the bar is a count, not a link');
  const header = await import('../dossier-ui-header.js');
  assert.match(header.dossierMenuHtml('a'), /delta-header-menu-toggle ss-tap-pill/);
  const css = await builtCss();
  assert.match(css, /--dt-meta:clamp\(/, 'type flows with the panel width');
  assert.doesNotMatch(css.match(/@media \(max-width: 900px\)/)?.[0] || '', /./, 'the sheet and the launcher agree on the full-screen line (1100)');
});

test('round 2 fix 2-4: the Mood section with three bars and the Pull last, Right now with where and what, Recent changes list, plain coloured tie words', async () => {
  const meters = { mood: { word: 'Alarmed', valence: -2, energy: 2, bars: { energy: 5, control: 2, max: 6 }, cause: 'trust dropped: Astra lied' }, pull: { kind: 'closure', level: 3, days: 0, cause: 'an open thread' },
    secrets: [], bars: [], notes: { ties: [{ name: 'Bregje', tags: ['rival'] }], lies: [{ hidden: true, day: 5 }], knows: [], tastes: [], drives: [] } };
  const base = { ...dossierDetailProjection({ id: 'r', name: 'Rika', location: 'Deck', goal: 'Pay the crew', status: 'Tense', keyRelationships: ['Bregje: rival | clashes'],
    fieldChanges: { mood: 3, location: 3 }, fieldChangeMessages: { mood: 3, location: 3 }, relationshipEventHistory: [{ impact: 'ordinary', reason: 'a gift', evidence: { desire: 'toffee' }, message: 1 }] }, {}, {}), v2Meters: v2MetersProjection(meters) };
  const now = sectionScreenHtml('mood', base, { reply: 3 });
  const where = sectionScreenHtml('now', base, { reply: 3 });
  assert.match(now, /<b>Alarmed<\/b> · unpleasant, keyed-up/, 'the word with the bars\' plain words');
  assert.equal((now.match(/delta-sheet-meter delta-mood-/g) || []).length, 3, 'Feeling, Energy, Control');
  assert.ok(now.indexOf('Recent changes') < now.indexOf('>Pull<'), 'Mood: the mood rows, Recent changes, then the Pull');
  assert.doesNotMatch(now, /Where and what|<dt>Goal/, 'where and what moved to Right now');
  assert.doesNotMatch(where, /Recent changes|delta-mood-rows|<dt>Mood|delta-pull-row/, 'Right now has no mood part');
  assert.match(where, /<dt>Where<\/dt>[\s\S]*<dt>Goal<\/dt>[\s\S]*<dt>Condition<\/dt>/);
  assert.doesNotMatch(now, /no change/, 'the reply changed the mood (the Updated line says so): no "no change" row');
  assert.match(now, /Earlier: trust dropped: Astra lied/, 'an older cause stands as a plain line, not a row');
  assert.match(now, /<h4 class="delta-subhead">Pull<\/h4><div class="delta-pull-row"><b>Closure<\/b><span class="delta-pips"[^>]*><i class="on"><\/i><i class="on"><\/i><i class="on"><\/i><\/span><span class="delta-muted">high · 0 days · an open thread<\/span> <span class="delta-new-badge">New<\/span>/);
  assert.match(now, /Updated this reply \(#3\): mood\./);
  assert.match(where, /Updated this reply \(#3\): where\./);
  assert.match(sectionScreenHtml('now', base, { reply: 5 }), /Updated at reply #3: where\./);
  assert.match(sectionScreenHtml('mood', base, { reply: 5 }), /Updated at reply #3: mood\./);
  const withHtml = sectionScreenHtml('with', { ...base, lastRelationshipChange: { impact: 'net', delta: { trust: 0, affection: 0, desire: 0, tension: 2 }, reason: '', turn: null, message: 3, hosted: true, event: { tier: 'meaningful', held: false, note: '', ask: [], date: 'Goldwane 21', gate: 'via praise · backfired' } } }, {});
  assert.match(withHtml, /Recent changes[\s\S]*delta-chg-when">Goldwane 21<br><small>#3<\/small>[\s\S]*data-good="no">Tension \+2[\s\S]*via praise: it backfired[\s\S]*Desire/);
  assert.doesNotMatch(withHtml, /Last relationship change/);
  const ties = sectionScreenHtml('ties', base, {});
  assert.match(ties, /data-tone="bad" data-tie-type="rival"><span class="delta-bond-word">Rival<\/span>/);
  assert.match(withHtml, /a lie you have not caught/, 'an uncaught lie never shows its words');
  const css = await builtCss();
  assert.doesNotMatch(css.match(/\.delta-bond-word \{[^}]*\}/g)?.join(' ') || '', /border:1px/, 'the relation word is plain coloured text, no pill');
});

test('round 2 fix 6-11: gate words, pronouns, the Pull ring at three quarters, tension rising is bad, a square-root dial, Character rows, one mood word', async () => {
  const { gateWords, possessiveWord } = await import('../dossier-ui-view-model.js');
  assert.equal(gateWords('via praise · 3rd in 2 days · backfired'), 'praise, the 3rd time in 2 days, backfired');
  assert.equal(gateWords('via praise · 3rd in 2 days · backfired', { row: true }), 'via praise: the 3rd time in 2 days, so it backfired');
  assert.equal(gateWords('via gift · less', { row: true }), 'via gift: it landed less');
  assert.equal(gateWords('whatever was written'), 'whatever was written', 'text that does not parse stays as it was');
  assert.deepEqual(['female', 'male', 'x'].map(g => possessiveWord(g, { lower: true })), ['her', 'his', 'their']);
  const tiles = boardTiles({ tiles: { lastChange: { moved: [{ axis: 'tension', label: 'Tension', value: 2 }] }, pull: { text: 'Closure', level: 3, note: 'high' }, mood: { text: 'Calm' } } }, { userName: 'Astra' });
  assert.equal(tiles[0].tone, 'bad', 'tension up reads as bad');
  assert.match(tiles.find(tile => tile.title === 'Mood').footHtml, /aria-label="strength 3 of 3"/, 'high is all three dots');
  assert.match(boardTiles({ tiles: { pull: { text: 'Awe', level: 1, note: 'low' }, mood: { text: 'Calm' } } }, {}).find(tile => tile.title === 'Mood').footHtml, /strength 1 of 3"[^>]*><i class="on"><\/i><i><\/i><i><\/i>/, 'low is one dot');
  const sweep = value => { const arc = dialArcs({ trust: value }).find(a => a.axis === 'trust'); const [x, y] = arc.path.split('A')[1].split(' ').slice(-2).map(Number); return Math.round(Math.atan2(x - 120, 120 - y) * 180 / Math.PI); };
  assert.equal(sweep(100), 90); assert.equal(sweep(25), 45); assert.ok(sweep(11) >= 28 && sweep(11) <= 32, 'about a third of the quadrant at +11');
  const { dossierIndexProjection } = await import('../dossier-ui-model.js');
  const { projectDossierState } = await import('../dossier-ui-catalog.js');
  const state = { npcs: [{ id: 'r', name: 'Rika', mood: 'Cautious', bucket: 'active' }], meterViews: { r: { bars: [], mood: { word: 'Alarmed', bars: { energy: 5, control: 1, max: 6 }, cause: '' } } } };
  assert.equal(projectDossierState(state).index[0].mood, 'Cautious', 'the library says what the board says: the scanner\'s own word leads');
  assert.equal(projectDossierState({ npcs: [{ id: 'r', name: 'Rika', mood: '', bucket: 'active' }], meterViews: state.meterViews }).index[0].mood, 'Alarmed', 'the numbers\' table word when the scanner wrote none');
  assert.ok(dossierIndexProjection);
  const npc = { ...dossierDetailProjection({ id: 'r', name: 'Rika', personality: 'Proud', speech: 'Sharp', behaviorProfile: ['Bickers', 'Hides fear'] }, {}, {}), birthday: 'Emberwane 17', birthdaySource: 'established' };
  const phone = dossierProfileHtml(npc, { layout: 'phone' });
  const desktop = dossierProfileHtml(npc, { layout: 'desktop' });
  assert.doesNotMatch(phone, /<h3>Identity<\/h3>/, 'no Identity heading on a phone'); assert.doesNotMatch(desktop, /<h3>Identity<\/h3>/, 'none on the desktop either: the rows sit under Profile');
  assert.match(desktop, /<p>Proud<\/p><dl class="delta-kv delta-profile-kv"><dt>Speech<\/dt><dd>Sharp<\/dd><dt>Levers<\/dt><dd>Bickers; Hides fear<\/dd>/);
  assert.doesNotMatch(desktop, /<h4>Personality|<h4>Speech/);
  assert.match(desktop, /<span>Emberwane 17<small class="delta-continuity-source">Story established<\/small><\/span>/, 'the note is in the value column, not a cell of its own');
});

test('round 3 fix 2-6: no tier line under a change row, a muted secrets intro, Levers joined without a doubled full stop, no Identity heading, the card dial without labels', async () => {
  const { recentChangeRowHtml } = await import('../dossier-ui-relationship.js');
  const { secretsSectionHtml } = await import('../dossier-ui-sections.js');
  const earlier = recentChangeRowHtml({ event: { impact: 'meaningful', reason: 'She shared the map.', axes: ['Trust'] } });
  assert.doesNotMatch(earlier, /meaningful change|ordinary change/);
  assert.match(earlier, /She shared the map\./);
  const latest = recentChangeRowHtml({ change: { impact: 'meaningful', reason: 'A kept promise.', delta: { trust: 3 } } });
  assert.doesNotMatch(latest, /meaningful change/);
  assert.match(secretsSectionHtml({ v2Meters: { secrets: [{ state: 'hidden', opens: 'opens at Trust 60', width: 10 }] } }), /<p class="delta-muted delta-secrets-intro">/);
  const npc = dossierDetailProjection({ id: 'r', name: 'Rika', personality: 'Proud', behaviorProfile: ['Never rushes before concluding business.', 'Honesty: high'] }, {}, {});
  assert.match(dossierProfileHtml(npc, { layout: 'desktop' }), /<dd>Never rushes before concluding business; Honesty: high<\/dd>/);
  const css = dossierUiSource();
  const mapCss = fs.readFileSync(new URL('../relationship-map-focus.js', import.meta.url), 'utf8');
  assert.match(mapCss, /\.delta-map-card-dial \.dial-label \{ display:none; \}/);
  assert.match(mapCss, /\.delta-map-ties-focus \.delta-map-ties-head \{ font-size:var\(--dt-kick\); letter-spacing:\.12em; text-transform:uppercase/);
  assert.match(css, /\.delta-section-body p\.delta-secrets-intro\.delta-muted \{[^}]*font-size:var\(--dt-meta\)/);
  assert.match(css, /--delta-muted: color-mix\(in srgb, var\(--delta-text\) 62%, transparent\);/);
  assert.match(fs.readFileSync(new URL("../dossier-ui-styles-board.js", import.meta.url), "utf8"), /\.delta-tile-dots::before \{ content:""; position:absolute/);
});

test("light themes: the neutral tones take their lightness from the panel's text colour and nothing keeps a fixed pale tone (12 Nov)", async () => {
  const board = await import("../dossier-ui-styles-board.js");
  const css = board.BOARD_STYLES;
  assert.match(css, /@supports \(color: oklch\(from white l c h\)\) \{[\s\S]*--good: oklch\(from var\(--delta-text\) clamp\(\.46, calc\(l \+ \.1\), \.78\) \.073 143\);/);
  for (const tone of ["bad", "held", "dsk-ten", "aff", "des", "trust"]) assert.match(css, new RegExp(`--${tone}: oklch\\(from var\\(--delta-text\\)`), tone);
  const dial = dialSvg({ trust: 11, affection: 11, desire: 6, tension: 13 });
  assert.doesNotMatch(dial, /(?:fill|stroke)="#(?:8fb4d9|d99aaa|b7a3cf|d9a273)"/, "the dial's arcs and labels follow the tone variables");
  assert.match(dial, /fill="var\(--trust, #8fb4d9\)"/);
  const styles = await import("../dossier-ui-styles.js");
  assert.match(css, /--delta-accent-soft: var\(--ss-text, oklch\(from var\(--delta-text\)/, "the panel's own fallbacks follow the text colour too");
  assert.match(styles.STYLES, /--delta-good: var\(--ss-good, #9ed5b6\);[\s\S]*--delta-danger: var\(--ss-bad-text, #efaaaa\);/);
  assert.doesNotMatch(styles.STYLES, /\.delta-rel-(step|delta)-\w+ \{ color:#/);
});

test('browser back: every history.go(-n) is skipped once (a counter); in Map mode a back leaves the map and keeps the dossier screen', () => {
  const saved = { history: globalThis.history, document: globalThis.document, CustomEvent: globalThis.CustomEvent };
  const pushed = [];
  const gone = [];
  const fired = [];
  globalThis.history = { pushState: state => pushed.push(state), go: n => gone.push(n) };
  globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
  globalThis.document = { dispatchEvent: event => fired.push(event.type) };
  try {
    const ui = new DeltaDossierUi({});
    ui.panelOpen = true;
    ui.setScreen(openNpc(ui.screen, 'rika'));
    ui.setScreen(openSection(ui.screen, 1));
    assert.equal(ui.navEntries, ui.screen.history.length);
    const depth = ui.navEntries;
    assert.ok(depth >= 2, 'the section is more than one screen deep');
    // two Esc presses before the first popstate arrives: two skips are owed, not one
    ui.setScreen(goBack(ui.screen));
    ui.setScreen(goBack(ui.screen));
    assert.equal(ui.ignorePops, 2, 'a counter, not a flag');
    ui.onPopState();
    ui.onPopState();
    assert.equal(ui.ignorePops, 0);
    assert.equal(ui.screen.name, 'library', 'the two skipped pops did not step the screen further');
    // Map mode: the screen stays, the map is asked to leave, the entry goes back on
    ui.setScreen(openNpc(ui.screen, 'rika'));
    ui.setScreen(openSection(ui.screen, 1));
    const before = { screen: ui.screen, entries: ui.navEntries };
    ui.root = { querySelector: selector => (selector === '.delta-spread.delta-map-mode' ? {} : null) };
    ui.onPopState();
    assert.equal(ui.screen, before.screen, 'the hidden dossier screen did not move');
    assert.equal(ui.navEntries, before.entries);
    assert.deepEqual(fired, ['npc-state-delta:leave-map']);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

test('the section "‹ Dossier" pill is hidden only where the board tiles are beside the section (three panes), by the container, not a device width', () => {
  const css = fs.readFileSync(new URL('../dossier-ui-styles-sections.js', import.meta.url), 'utf8');
  assert.match(css, /@container dsr \(min-width: \$\{THREE_PANE_MIN\}px\) \{ #\$\{ROOT_ID\} \.delta-section-back \{ display:none; \} \}/);
  assert.doesNotMatch(css, /@media[^{]*\{[^}]*delta-section-back/);
});

// ---- numbers and reasons for the mood and the meters (VADFIX) ----
test('mood rows: Feeling / Energy / Control with their number on the -3..+3 scale and this reply\'s change on the same line; the last 3 changes, a quiet reply first; "no reason given"', async () => {
  const log = [
    { n: 112, date: 'Goldwane 21', v: -1, a: 2, d: -1, why: 'now alarmed \u2014 the crawlers breached the fissure' },
    { n: 108, date: 'Goldwane 21', a: 1, why: '' },
    { n: 104, date: 'Goldwane 20', v: 1, d: 1, why: 'warned Astra in time' },
    { n: 100, date: 'Goldwane 19', v: 1, why: 'ancient' },
  ];
  const meters = { mood: { word: 'Alarmed', valence: -1, energy: 2, control: -1, bars: { energy: 5, control: 2, max: 6 }, cause: '', log }, bars: [], secrets: [] };
  const base = { ...dossierDetailProjection({ id: 'r', name: 'Rika', gender: 'female' }, {}, {}), v2Meters: v2MetersProjection(meters) };
  const now = sectionScreenHtml('mood', base, { reply: 112 });
  assert.match(now, /delta-mood-feel[^"]*"><span>Feeling<\/span><i class="delta-sheet-track"[^>]*><b style="left:33\.3\d*%;width:16\.6\d*%"><\/b><\/i><strong>\u22121<\/strong><em class="delta-sheet-chip" data-good="no">\u22121<\/em>/, 'number and chip on the one row');
  assert.match(now, /delta-mood-energy[^"]*"><span>Energy<\/span>[\s\S]*<strong>\+2<\/strong><em class="delta-sheet-chip" data-good="yes">\+2<\/em>/);
  assert.equal((now.match(/class="delta-chg"/g) || []).length, 3, 'the last three changes only');
  assert.doesNotMatch(now, /ancient/);
  assert.match(now, /Goldwane 21<br><small>#112<\/small>[\s\S]*Feeling \u22121[\s\S]*Energy \+2[\s\S]*Control \u22121[\s\S]*the crawlers breached/);
  assert.match(now, /Energy \+1<\/span><\/b><div class="delta-chg-via">no reason given/, 'no reason recorded is said plainly');
  const quiet = sectionScreenHtml('mood', base, { reply: 115 });
  assert.match(quiet, /<h4 class="delta-subhead">Recent changes<\/h4><ul class="delta-list"><li class="delta-chg"><span class="delta-chg-when"><small>#115<\/small><\/span><div><b><span class="delta-chg-d" data-good="muted">no change \u00b7 fading toward her calm/, 'a quiet reply starts the list');
  assert.equal((quiet.match(/class="delta-chg"/g) || []).length, 3, 'the quiet row counts in the three');
  assert.doesNotMatch(quiet, /delta-sheet-chip"/, 'no chip when the reply on show moved nothing');
  assert.match(quiet, /<em class="delta-sheet-chip-slot"/, 'an empty chip slot keeps the bar columns aligned');
  const board = boardHtml(base, { reply: 112 });
  assert.match(board, /delta-mood-rows[\s\S]*Feeling[\s\S]*Energy[\s\S]*Control/, 'the board tile shows all three');
});

test('meters: the story line\'s reason shows on the Last change tile and the Recent changes row; none recorded says so; the list is capped at 3', async () => {
  const base = dossierDetailProjection({ id: 'r', name: 'Rika' }, {}, {});
  const change = why => ({ impact: 'net', delta: { trust: 0, affection: 2, desire: 0, tension: 2 }, reason: why, turn: null, message: 3, hosted: true, event: { tier: 'meaningful', held: false, note: '', ask: [], date: 'Goldwane 21', gate: 'via help', why } });
  const withWhy = { ...base, lastRelationshipChange: change('Astra helped her cover up') };
  assert.match(boardHtml(withWhy, {}), /Affection \+2 \u00b7 Tension \+2<\/b> \u00b7 [^<]*<\/span><span class="delta-tile-small">Astra helped her cover up/);
  assert.match(sectionScreenHtml('with', withWhy), /delta-chg-via">via help — Astra helped her cover up/, 'how it came about and why on one line');
  const without = { ...base, lastRelationshipChange: change('') };
  assert.doesNotMatch(boardHtml(without, {}), /no reason given/, 'the gate words stand alone: no "no reason given" under them');
  const bare = { ...base, lastRelationshipChange: { ...change(''), event: { ...change('').event, gate: '' } } };
  assert.match(boardHtml(bare, {}), /no reason given/, 'neither a reason nor gate words: said plainly');
  assert.match(sectionScreenHtml('with', without), /delta-chg-via">via help — no reason given/);
  const many = { ...without, recentRelationshipChanges: [1, 2, 3, 4].map(n => ({ impact: 'ordinary', reason: `r${n}`, axes: ['trust'], message: n })) };
  assert.equal((sectionScreenHtml('with', many).match(/class="delta-chg"/g) || []).length, 3, 'at most the last three, the latest among them');
});

test('profile: every section keeps its heading and a muted one-line placeholder when empty; a thin line above every block but the first row', async () => {
  const html = dossierProfileHtml({ id: 'r', name: 'Rika', v2Meters: { notesOn: true } }, { layout: 'desktop' });
  for (const key of ['appearance', 'character', 'tastes', 'drives', 'background']) assert.match(html, new RegExp(`data-delta-profile="${key}"`), key);
  assert.match(html, /No tastes yet: they appear when the story shows a like or dislike/);
  assert.match(html, /<span>Belonging<\/span>[\s\S]*<span>Honesty<\/span>/, 'Drives: the full list even with no record');
  assert.equal((html.match(/Nothing known yet/g) || []).length, 2, 'Character and Background');
  const css = await builtCss();
  assert.match(css, /\.delta-profile-block \{ border-top:1px solid var\(--delta-line\)/);
  assert.match(css, /\.delta-profile-cols > \.delta-profile-block:nth-child\(2\) \{ border-top:0/, 'desktop: no line above the first row');
  assert.doesNotMatch(css, /nth-child\(2\) \{ border-top:0; padding-top:0; \}/, 'the second column keeps main\'s 4px top padding so the top row lines up');
  assert.match(css, /--feel: #e2c46f; --energy: #e08a5b; --control: #7fb6ad/, 'the three mood axes are skin tokens, with light-theme variants');
  assert.match(css, /--feel: oklch\(from var\(--delta-text\)/);
});

test('six sections: the Mood tile opens Mood with the Pull in its foot, Ties counts ties not lies, every entry has a divider and every sub-heading one spacing rule', async () => {
  const lies = [{ hidden: false, to: 'Astra', said: 'I sold nothing', day: 3, caught: { day: 4 } }, { hidden: true, to: 'Astra', day: 5 }];
  const npc = { ...rika, keyRelationships: ['Temiwa: friend | kind', 'Vane: rival | clashes'], v2Meters: { bars: [], secrets: [], pull: { kind: 'closure', level: 2, days: 1, cause: '' }, notes: { lies, knows: [{ about: 'Y', how: 'heard', day: 3, text: 'Y owes a debt', secret: false, hidden: false }], ties: [], tastes: [], drives: [] } } };
  const html = boardHtml(npc, {});
  assert.match(html, /data-delta-section="mood"[\s\S]*delta-pull-row[\s\S]*strength 2 of 3/);
  assert.equal((html.match(/delta-pull-row/g) || []).length, 1, 'one Pull line, no card of its own');
  assert.match(html, /<span class="delta-tile-small">2 · Temiwa, Vane<\/span>/, 'the Ties tile counts ties only');
  assert.doesNotMatch(html, / · \d+ lies?\b/);
  const ties = sectionScreenHtml('ties', npc, {});
  assert.doesNotMatch(ties, /delta-notes-block/);
  assert.match(sectionScreenHtml('with', npc, {}), /data-notes="lies"/);
  assert.match(sectionScreenHtml('secrets', npc, {}), /data-notes="knows"/);
  const css = await builtCss();
  assert.match(css, /\.delta-bond, [^{]*\.delta-note-row \{ margin:0; padding:clamp\(12px,1\.6cqw,18px\) 0; border-top:1px solid var\(--delta-line\); \}/, 'every tie, lie and knows entry: a divider above, one spacing');
  assert.match(css, /\.delta-sheet \.delta-subhead \{ margin:18px 0 0; \}/, 'one shared rule spaces every sub-heading');
  assert.doesNotMatch(css, /\.delta-notes-block h4 \{[^}]*margin/, 'no heading sets its own spacing');
  for (const id of ['mood', 'with', 'secrets']) assert.equal((sectionScreenHtml(id, npc, {}).match(/<h4(?! class="delta-subhead")/g) || []).length, 0, `${id}: every sub-heading carries the shared class`);
});

test('VADFIX2: a quiet reply for a mood that already rests says "no mood change this reply", not that it fades', async () => {
  const at = (axes, rest) => ({ ...dossierDetailProjection({ id: 'r', name: 'Rika', mood: 'Steady' }, {}, {}), v2Meters: v2MetersProjection({ mood: { word: 'Steady', valence: axes[0], energy: axes[1], control: axes[2], bars: { energy: 3 + axes[1], control: 3 + axes[2], max: 6 }, cause: '', rest: { v: rest[0], a: rest[1], d: rest[2] }, log: [] }, secrets: [], bars: [] }) });
  const resting = sectionScreenHtml('mood', at([1, 0, 0], [1, 0, 0]), { reply: 9 });
  assert.match(resting, /no mood change this reply/);
  assert.doesNotMatch(resting, /fading toward/);
  const away = sectionScreenHtml('mood', at([-2, 2, 0], [0, 0, 0]), { reply: 9 });
  assert.match(away, /no change · fading toward (her|his|their) calm/, 'still away from rest: it fades');
  assert.doesNotMatch(away, /no mood change this reply/);
});

test('Ties: each tie is three stacked lines (type label, name, description); a long type wraps; spacing between lines and ties is in the container styles', async () => {
  const { SECTIONS_STYLES } = await import('../dossier-ui-styles-sections.js');
  const ties = sectionScreenHtml('ties', { keyRelationships: ['Sister Temiwa — novice companion present at the counter | shares the cramped office and covered Sieke with an altar-cloth', 'Bregje — rival | clashes at the annex'] }, {});
  const rows = ties.match(/<div class="delta-bond"[\s\S]*?<\/div>/g) || [];
  assert.equal(rows.length, 2);
  assert.match(rows[0], /<span class="delta-bond-word">Ally<\/span><b>Sister Temiwa<\/b><p>novice companion present at the counter — shares the cramped office/, 'tie type, then name, then description (relation as written, then dynamic), in that order');
  const css = SECTIONS_STYLES.replace(/\$\{ROOT_ID\}/g, '#r');
  const rule = selector => css.split('\n').filter(line => line.includes(selector)).join('\n');
  assert.doesNotMatch(rule('.delta-bond { grid-template-columns'), /auto minmax/, 'the type no longer sits beside the name');
  assert.match(rule('.delta-bond { grid-template-columns'), /grid-template-columns:minmax\(0,1fr\)[^}]*gap:clamp\([^}]*cqw/, 'space between the lines follows the container');
  assert.match(css, /\.delta-bond, [^{]*\.delta-note-row \{ margin:0; padding:clamp\([^}]*cqw[^}]*border-top/, 'the container-sized spacing is the one padding for ties, lies and knows');
  assert.match(rule('.delta-bond-word {'), /display:block[^}]*overflow-wrap:anywhere/);
  assert.match(rule('.delta-bond > b'), /grid-row:2/);
  assert.match(rule('.delta-bond > p'), /grid-row:3/);
  assert.doesNotMatch(css, /\.delta-bond[^{]*\{[^}]*\b\d+px\s+(?:device|screen)|@media[^{]*\.delta-bond/, 'no device widths');
  assert.doesNotMatch(css, /\.delta-bond:first-child/, 'v21: no first-child reset; the first tie has its divider and the same spacing as every other entry');
});

test('Past: a stamped memory shows its story date and reply as a small label; an older memory shows none; the text is untouched', async () => {
  const { SECTIONS_STYLES } = await import('../dossier-ui-styles-sections.js');
  const memories = ['Met Astra at the counter', 'Spilled the ink'];
  const stamps = { 'met astra at the counter': { m: 4, d: 'Icewane 27' }, 'spilled the ink': { m: 9 } };
  const old = sectionScreenHtml('past', { memories: [...memories, 'An old memory'], memoryStamps: stamps }, {});
  assert.match(old, /<span class="delta-mem-when">Icewane 27 · #4<\/span><span>Met Astra at the counter<\/span>/);
  assert.match(old, /<span class="delta-mem-when">#9<\/span><span>Spilled the ink<\/span>/, 'no clock: the reply number alone');
  assert.match(old, /<\/i><span>An old memory<\/span>/, 'a memory recorded before stamps has no label');
  assert.equal((old.match(/delta-mem-when/g) || []).length, 2);
  assert.doesNotMatch(sectionScreenHtml('past', { memories }, {}), /delta-mem-when/);
  assert.match(sectionScreenHtml('past', { memories: ['<b>x</b>'], memoryStamps: { 'b x b': { m: 1, d: '<i>' } } }, {}), /&lt;i&gt;/, 'the date is escaped');
  const cssAll = SECTIONS_STYLES.replace(/\$\{ROOT_ID\}/g, '#r');
  assert.match(cssAll, /\.delta-timeline li, #\S+ \.delta-timeline li:first-child \{ display:grid[^}]*padding-bottom:clamp\(8px/, 'the first Past item has the same gap as the others');
  const projected = dossierDetailProjection({ id: 'r', name: 'R', memories, memoryStamps: { ...stamps, 'gone one': { m: 1 } } });
  assert.deepEqual(Object.keys(projected.memoryStamps), ['met astra at the counter', 'spilled the ink'], 'the projection keeps stamps of stored memories only');
});

// ---- polish 2: mood words from the shown numbers, no bare "last mood move" row, quiet row vs. the updated line, empty Right now ----
test('mood words come from the rows\' numbers; the old cause folds into a row or stands as one line, never a bare row; a changed mood is not "no change"', async () => {
  const mk = (mood, extra = {}) => ({ ...dossierDetailProjection({ id: 'r', name: 'Rika', gender: 'female', ...extra }, {}, {}), v2Meters: v2MetersProjection({ mood, bars: [], secrets: [] }) });
  const flat = sectionScreenHtml('mood', mk({ word: 'Alarmed', valence: -2, energy: 0, control: 0, bars: { energy: 6, control: 0, max: 6 }, cause: '' }), { reply: 3 });
  assert.match(flat, /<b>Alarmed<\/b> · unpleasant<\/dd>/, 'Energy 0 and Control 0 say nothing, whatever the step bars hold');
  const old = sectionScreenHtml('mood', mk({ word: 'Wary', valence: 0, energy: 0, control: 0, bars: { energy: 3, control: 3, max: 6 }, cause: 'trust dropped: Astra lied' }));
  assert.doesNotMatch(old, /last mood move/);
  assert.match(old, /delta-muted">Earlier: trust dropped: Astra lied<\/p>/, 'no row to join: one muted line');
  const quietOld = sectionScreenHtml('mood', mk({ word: 'Wary', valence: 0, energy: 0, control: 0, bars: { energy: 3, control: 3, max: 6 }, cause: 'trust dropped: Astra lied' }), { reply: 5 });
  assert.match(quietOld, /<small>#5<\/small>[\s\S]*delta-chg-via">Earlier: trust dropped: Astra lied<\/div><\/div><\/li>/, 'folded into the oldest row');
  const changed = sectionScreenHtml('mood', mk({ word: 'Wary', valence: 0, energy: 0, control: 0, bars: { energy: 3, control: 3, max: 6 }, cause: '' }, { fieldChanges: { mood: 3 }, fieldChangeMessages: { mood: 3 } }), { reply: 3 });
  assert.match(changed, /Updated this reply \(#3\): mood/);
  assert.doesNotMatch(changed, /no change/, 'the reply changed the mood: no "no change" row');
  assert.match(sectionScreenHtml('now', mk(null)), /Nothing recorded yet\./, 'an empty Right now says so');
});

test('mood lexicon tokens keep a curly apostrophe; scanner numbers must be numbers or numeric strings', async () => {
  const { plainMoodWords, moodNumbers } = await import('../npc-mood.js');
  assert.deepEqual(plainMoodWords('she isn\u2019t angry'), [], 'curly n\u2019t negates like the straight one');
  assert.deepEqual(plainMoodWords("she isn't angry"), []);
  assert.deepEqual(moodNumbers({ moodV: '2', moodA: -1, moodD: 0 }), { v: 2, a: -1, d: 0 });
  for (const bad of [true, [2], ' ', {}]) assert.equal(moodNumbers({ moodV: bad, moodA: 1, moodD: 1 }), null, `${JSON.stringify(bad)} is not a number`);
});
