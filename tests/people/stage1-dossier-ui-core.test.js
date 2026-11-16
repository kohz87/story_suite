import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseDossierSelection,
  dossierDetailProjection,
  dossierIndexProjection,
  dossierLifeBucket,
  dossierStatusLabel,
  filterDossierIndex,
  projectDossierState,
  sortDossierIndex,
} from '../../modules/people/legacy/dossier-ui.js';
import { boardHtml } from '../../modules/people/legacy/dossier-ui-board.js';
import { createPortraitRefs } from '../../modules/people/legacy/dossier-ui-html.js';
import { dialArcs, dialSvg } from '../../modules/people/legacy/dossier-ui-dial.js';
import { SECTIONS_STYLES as sectionsCss } from '../../modules/people/legacy/dossier-ui-styles-sections.js';
import { dossierProfileHtml, profileMeterItems } from '../../modules/people/legacy/dossier-ui-profile.js';
import { SECTION_KEYS } from '../../modules/people/legacy/dossier-ui-screens.js';
import { sectionHeaderHtml, sectionScreenHtml } from '../../modules/people/legacy/dossier-ui-sections.js';
import { boardModel, bondTone, libraryTone } from '../../modules/people/legacy/dossier-ui-view-model.js';
import { bootstrap, cast, rika, uiSource } from './stage1-dossier-ui.helpers.js';

test('Stage 1 lifecycle buckets are presentation-only and expose active archived dead filters', () => {
  assert.equal(dossierLifeBucket(cast[0]), 'active');
  assert.equal(dossierLifeBucket(cast[2]), 'archived');
  assert.equal(dossierLifeBucket(cast[3]), 'dead');
  assert.equal(dossierStatusLabel(cast[1]), 'In chat');
  assert.equal(dossierStatusLabel(cast[0]), 'Active off-screen');
  assert.equal(dossierStatusLabel(cast[2]), 'Archived · stale');
  assert.equal(dossierStatusLabel(cast[3]), 'Deceased');
});

test('Stage 1 cast ordering keeps present and active dossiers first', () => {
  const rows = sortDossierIndex(cast.map(npc => dossierIndexProjection(npc)));
  assert.deepEqual(rows.map(row => row.id), ['sora', 'mira', 'old', 'fallen']);
});

test('Stage 1 cast search and lifecycle filters compose', () => {
  const rows = cast.map(npc => dossierIndexProjection(npc));
  assert.deepEqual(filterDossierIndex(rows, { query: 'stormcrown' }).map(row => row.id), ['sora']);
  assert.deepEqual(filterDossierIndex(rows, { query: 'north road', filter: 'active' }).map(row => row.id), ['mira']);
  assert.deepEqual(filterDossierIndex(rows, { query: 'northwatch lodge', filter: 'active' }).map(row => row.id), ['mira']);
  assert.deepEqual(filterDossierIndex(rows, { filter: 'archived' }).map(row => row.id), ['old']);
  // Since 1.1.4 the dead are left out of the list and found by search (see v114-hide-dead).
  assert.deepEqual(filterDossierIndex(rows, { query: 'fallen' }).map(row => row.id), ['fallen']);
});

test('Stage 1 selection survives updates while the selected dossier remains visible', () => {
  const rows = sortDossierIndex(cast.map(npc => dossierIndexProjection(npc)));
  const visible = filterDossierIndex(rows, { filter: 'active' });
  assert.equal(chooseDossierSelection('mira', visible, rows), 'mira');
  assert.equal(chooseDossierSelection('old', visible, rows), 'sora');
  assert.equal(chooseDossierSelection('', [], rows), 'sora');
  const updated = rows.map(row => row.id === 'mira' ? { ...row, status: 'Moving' } : row);
  assert.equal(chooseDossierSelection('mira', filterDossierIndex(updated, { filter: 'active' }), updated), 'mira');
});

test('Stage 1 projections stay read-only and discard heavy history fields', () => {
  const source = {
    turn: 9,
    portraitAssets: { sora: { dataUrl: 'data:image/png;base64,AA==' } },
    npcs: [{
      ...cast[1],
      appearance: 'Golden-blue hair.',
      behaviorProfile: ['Observant', 'Proud'],
      memories: ['First meeting'],
      relationshipHistory: [{ reason: 'heavy history should not reach the view projection' }],
      branchSnapshots: [{ huge: true }],
    }],
  };
  const before = structuredClone(source);
  const projected = projectDossierState(source, { chatKey: 'chat-1', hydrationStatus: 'ready' });
  assert.deepEqual(source, before);
  assert.equal(projected.turn, 9);
  assert.equal(projected.npcs[0].portrait, 'data:image/png;base64,AA==');
  assert.equal(projected.npcs[0].relationship.trust, 12);
  assert.equal('relationshipHistory' in projected.npcs[0], false);
  assert.equal('branchSnapshots' in projected.npcs[0], false);
});

test('Stage 1 no-chat projection does not create or mutate dossier state', () => {
  const projected = projectDossierState({}, { chatKey: 'no-chat', hydrationStatus: 'ready' });
  assert.equal(projected.chatKey, 'no-chat');
  assert.deepEqual(projected.npcs, []);
  assert.deepEqual(projected.index, []);
});

test('Detail projection preserves editable fields and leaves flat current appearance scalar-only', () => {
  const projected = dossierDetailProjection({
    id: 'ryu', name: 'Ryu', species: 'Chimera', homeBase: 'Towerhouse', age: '6 years', apparentAge: '~6',
    appearance: 'Long silver hair.', personality: 'Composed', speech: 'Precise',
    behaviorProfile: ['Analytical'], mannerisms: ['Studies details'], background: 'Unknown past',
    mood: 'Calm', location: 'Towerhouse', goal: 'Observe', status: 'Well',
    keyRelationships: ['Lucien - guardian'], memories: ['Learned to read'],
    relationshipSummary: 'Quiet trust', relationship: { trust: 9, affection: 4, desire: 0, tension: -2 },
  });
  assert.equal(projected.appearance, 'Long silver hair.');
  assert.equal(projected.homeBase, 'Towerhouse');
  assert.deepEqual(projected.behaviorProfile, ['Analytical']);
  assert.equal(projected.relationship.trust, 9);
  assert.deepEqual(projected.appearanceModel.appearanceForms, []);
  assert.equal(projected.appearanceModel.currentForm, '');
});

test('Stage 1 UI is a thin adapter over the existing runtime editor/settings owners', () => {
  assert.match(uiSource, /this\.api\.openEditor\(id\)/);
  assert.match(uiSource, /row\('Levers'/, 'the levers read as a label / value row in Character');
  assert.match(uiSource, /relationshipSummary/, 'the player dynamic reads in the With section');
  assert.match(uiSource, /\['Condition', escapeHtml\(plain\(npc\.status\)\)\]/);
  assert.match(uiSource, /currentCard\('Home base'/);
  assert.doesNotMatch(uiSource, /proseHtml\(selected\.appearance\)/, 'resolved flat appearance must not be rendered beside the form model');
  assert.match(uiSource, /npc_state_delta_settings/);
  assert.match(uiSource, /MutationObserver/);
  assert.doesNotMatch(uiSource, /persistCritical\s*\(/);
  assert.doesNotMatch(uiSource, /applyNpcStateCommand\s*\(/);
  assert.doesNotMatch(uiSource, /relationshipDelta\s*=/);
  assert.doesNotMatch(uiSource, /scanNow\s*\(/);
});

test('Stage 1 UI loads after the canonical legacy runtime and remains package-reachable', () => {
  const engine = bootstrap.indexOf("await import('./index.js')");
  const ui = bootstrap.indexOf("await import('./dossier-ui.js')");
  assert.ok(engine >= 0, 'canonical runtime import missing');
  assert.ok(ui > engine, 'Stage 1 UI must load after the canonical runtime API exists');
});

test('bond tone: close, hostile, duty and neutral relations', async () => {
  const { bondTone } = await import('../../modules/people/legacy/dossier-ui-bond-tone.js');
  assert.equal(bondTone('mother'), 'close');
  assert.equal(bondTone('rival'), 'hostile');
  assert.equal(bondTone('former friend turned enemy'), 'hostile');
  assert.equal(bondTone('owes him a debt'), 'duty');
  assert.equal(bondTone('colleague'), 'neutral');
  assert.equal(bondTone(''), 'neutral');
});

test('bond tone: green for kin and friends, red for rivals and enemies, gold for debts and duties, grey otherwise', () => {
  for (const word of ['friend', 'mother', 'sister', 'partner', 'mentor', 'student', 'guardian', 'ward', 'cousin']) assert.equal(bondTone(word), 'good', word);
  for (const word of ['rival', 'sworn enemy', 'nemesis', 'hates']) assert.equal(bondTone(word), 'bad', word);
  for (const word of ['owes a debt', 'owes her life', 'duty-bound', 'sworn oath']) assert.equal(bondTone(word), 'gold', word);
  for (const word of ['employer', 'acquaintance', '', null, undefined]) assert.equal(bondTone(word), 'grey', String(word));
  assert.equal(libraryTone({ trust: 30 }), 'ally');
  assert.equal(libraryTone({ trust: -30 }), 'rival');
  assert.equal(libraryTone({ trust: 5, tension: 60 }), 'rival');
  assert.equal(libraryTone({ trust: 5, affection: 5 }), '');
  assert.equal(libraryTone(undefined), '');
});

test('the library index rows carry the ring tone from the meters', () => {
  const state = projectDossierState({ npcs: [{ id: 'a', name: 'A', relationship: { trust: 40 } }, { id: 'b', name: 'B', relationship: { trust: -40 } }, { id: 'c', name: 'C' }] }, { chatKey: 'c', hydrationStatus: 'ready' });
  assert.deepEqual(Object.fromEntries(state.index.map(row => [row.id, row.tone])), { a: 'ally', b: 'rival', c: undefined });
});

test('the board model reads only stored fields: dial, tiles, no Pull, and missing fields do not throw', () => {
  const model = boardModel(rika);
  assert.deepEqual(model.dial.map(item => [item.axis, item.value]), [['trust', 11], ['affection', 10], ['desire', 6], ['tension', 13]]);
  assert.equal(model.tiles.pull, null, 'Pull waits for phase-2 data');
  assert.deepEqual(model.tiles.lastChange.moved.map(item => item.value), [2, -1]);
  assert.equal(model.tiles.ties.count, 4);
  assert.equal(model.tiles.past.latest, 'Found by Temiwa');
  assert.deepEqual([model.tiles.secrets.total, model.tiles.secrets.open, model.tiles.secrets.next], [2, 1, 'Opens at Trust 25']);
  const empty = boardModel({});
  assert.equal(empty.name, 'Unnamed NPC');
  assert.equal(empty.tiles.ties.count, 0);
  assert.equal(boardModel(null).tiles.secrets.total, 0);
  assert.equal(boardModel({ relationship: { trust: 999 } }).dial[0].value, 100, 'clamped to the meter range');
});

test('the dial draws four arcs from the meters and escapes its labels', () => {
  const arcs = dialArcs({ trust: 50, affection: -100, desire: 0, tension: 100 });
  assert.deepEqual(arcs.map(arc => [arc.axis, arc.value, Boolean(arc.path), arc.negative]), [['trust', 50, true, false], ['affection', -100, true, true], ['desire', 0, false, false], ['tension', 100, true, false]]);
  const svg = dialSvg({ trust: 11 });
  assert.match(svg, /aria-label="Meter dial: trust \+11/);
  assert.match(svg, /dial-arc/);
  assert.doesNotMatch(svg, /<script/);
});

test('the board shows the tiles in order with the player\'s name, escapes text and never inlines a portrait', () => {
  const refs = createPortraitRefs();
  const html = boardHtml({ ...rika, name: '<img src=x>', mood: '<b>', portrait: 'data:image/png;base64,AAAA' }, { userName: 'Astra', refs });
  assert.doesNotMatch(html, /<img src=x>|<b>/);
  assert.match(html, /With Astra · Last change/);
  assert.doesNotMatch(html, /Pull/i);
  assert.doesNotMatch(html, /data:image/, 'the portrait goes through refs, not the markup');
  assert.match(html, /data-delta-portrait="\d+"/);
  assert.match(html, /data-delta-screen="profile"/);
  for (const section of ['mood', 'with', 'now', 'ties', 'past', 'secrets']) assert.match(html, new RegExp(`data-delta-section="${section}"`), section);
  assert.match(html, /Human · Female · Mage/, 'each identity part keeps its words with the first letter capitalised');
  // Mood tile: the word plus both bars, also for a person with no hosted mood (a mid-step rest) and no scanner word (the resting word).
  assert.match(html, /Energy[\s\S]*Control/);
  const rest = boardHtml({ ...rika, mood: '', v2Meters: undefined }, {});
  assert.match(rest, /delta-mood-feel[^"]*"><span>Feeling<\/span>[\s\S]*delta-mood-energy[^"]*"><span>Energy<\/span>[\s\S]*delta-mood-control[^"]*"><span>Control<\/span>/, 'the Mood tile shows all three rows, each with its number');
  assert.match(boardHtml({ id: 'x', name: 'Marrit', gender: 'male', role: 'bargemaster' }, {}), /Male · Bargemaster/);
});

test('sections: six screens with arrows and dots; hidden secrets never show their words; bond tones', () => {
  assert.deepEqual([...SECTION_KEYS], ['mood', 'now', 'with', 'ties', 'past', 'secrets']);
  const head = sectionHeaderHtml('now', { npcName: 'Rika', userName: 'Astra' });
  assert.match(head, /Rika · 2 of 6/);
  assert.match(sectionHeaderHtml('mood', { npcName: 'Rika' }), /data-delta-section-step="-1"[^>]*disabled/, 'no previous before the first');
  assert.doesNotMatch(sectionHeaderHtml('secrets', {}), /data-delta-section-step="1"[^>]*aria-label="Next section"><|data-delta-section-step="1"[^>]*>(?!›)/);
  assert.match(sectionHeaderHtml('secrets', {}), /data-delta-section-step="1"[^>]*disabled/, 'no next after the last');
  assert.match(sectionHeaderHtml('with', { userName: 'Astra' }), /With Astra/);
  assert.match(head, /class="delta-section-back" data-delta-screen="board"[^>]*>‹ Dossier<\/button>/, 'every section has a visible way back to the board');
  const now = sectionScreenHtml('now', rika, {});
  assert.match(now, /mending a net/);
  const ties = sectionScreenHtml('ties', rika, {});
  assert.match(ties, /data-tone="good"[^>]*>[\s\S]*Temiwa/);
  assert.match(ties, /data-tone="bad"/);
  assert.match(ties, /data-tone="gold"/);
  assert.match(ties, /a loose fragment/, 'an entry that does not parse is shown as written');
  assert.match(sectionScreenHtml('past', rika, {}), /Fled by raft/);
  const secrets = sectionScreenHtml('secrets', rika, {});
  assert.match(secrets, /Her past/);
  assert.match(secrets, /Opens at Trust 25/);
  const hidden = sectionScreenHtml('secrets', { v2Meters: { secrets: [{ state: 'hidden', title: 'LEAK', text: 'LEAK', opens: 'Opens at Trust 25', width: 40 }] } }, {});
  assert.doesNotMatch(hidden, /LEAK/);
  assert.match(sectionScreenHtml('with', rika, { userName: 'Astra' }), /Prickly but grateful/);
  assert.equal(sectionScreenHtml('nope', rika, {}), '');
  assert.match(sectionScreenHtml('past', {}, {}), /Nothing remembered yet/, 'a bare record still draws');
  assert.doesNotMatch(sectionScreenHtml('now', { ...rika, mood: '<script>' }, {}), /<script>/);
});

test('the profile: portrait first, identity and appearance, phone and desktop layouts, stale-portrait note', () => {
  const phone = dossierProfileHtml({ ...dossierDetailProjection({ id: 'rika', name: 'Rika', age: '19', homeBase: 'Bluewatch' }), portraitAppearanceChanged: true }, { layout: 'phone' });
  assert.match(phone, /delta-profile-phone/);
  assert.match(phone, /data-delta-screen="board"[^>]*>‹ Dossier</);
  assert.match(phone, /Appearance changed since portrait/);
  const desktop = dossierProfileHtml(rika, { layout: 'desktop' });
  assert.match(desktop, /delta-profile-desktop/);
  assert.match(desktop, /<i>Trust \+11<\/i><i>Affection \+10<\/i><i>Desire \+6<\/i><i>Tension \+13<\/i>/);
  assert.deepEqual(profileMeterItems({ relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } }), ['Trust 0', 'Affection 0', 'Desire 0', 'Tension 0']);
  assert.doesNotMatch(desktop, /(?:>|\s)Te \+|\bT \+11/);
  assert.match(desktop, /‹ Dossier<\/button>/);
  assert.match(desktop, /delta-profile-cols/);
  assert.doesNotMatch(dossierProfileHtml({ name: '<i>x' }, {}), /<i>x/);
  assert.match(dossierProfileHtml({ name: 'Ada Vale' }, { layout: 'desktop' }), /delta-portrait-placeholder[^>]*><span>AV<\/span>/, 'no portrait: two initials');
  const opening = dossierProfileHtml({ name: 'Ada', personality: 'Calm.', fieldChanges: { latest: ['personality'], latestTurn: 0, message: 0 } }, {});
  assert.doesNotMatch(opening, /delta-changed-mark/, 'the opening reply (#0) carries no news: no mark');
  assert.match(opening, /<h3>Character<\/h3>/);
  const marked = dossierProfileHtml({ name: 'Ada', personality: 'Calm.', fieldChanges: { latest: ['personality'], latestTurn: 3, message: 12 } }, {});
  assert.match(marked, /<h3>Character <em class="delta-changed-mark[^>]*>• #12<\/em><\/h3>/, 'a later change shows its mark in the Character heading, not on a line of its own');
  assert.doesNotMatch(marked, /<p class="delta-muted"> ?<em/, 'no stray marker line under Character');
});

test('profile polish: empty sections keep a heading and a muted line; one Age field; section caption meters in colour', () => {
  const bare = dossierProfileHtml({ name: 'Ada', v2Meters: { bars: [], notesOn: true } }, { layout: 'phone' });
  const off = dossierProfileHtml({ name: 'Ada', v2Meters: { bars: [] } }, { layout: 'phone' });
  const standalone = dossierProfileHtml({ name: 'Ada' }, { layout: 'phone' });
  for (const html of [off, standalone]) assert.doesNotMatch(html, /Tastes|Drives|No tastes yet|All normal so far/, 'notes off or no host: no placeholders');
  for (const title of ['Appearance', 'Character', 'Tastes', 'Drives', 'Background']) assert.match(bare, new RegExp(`<h3>${title}</h3>`), `${title} keeps its heading`);
  assert.match(bare, /No tastes yet: they appear when the story shows a like or dislike/);
  assert.doesNotMatch(bare, /All normal so far/, 'no record: the full list, not a line');
  assert.equal((bare.match(/class="delta-drive" data-level="normal"/g) || []).length, 7, 'seven normal rows');
  for (const label of ['Belonging', 'Closure', 'Awe', 'Preservation', 'Comfort', 'Conflict', 'Honesty']) assert.match(bare, new RegExp(`<span>${label}</span>`));
  assert.match(bare, /The middle of each bar is normal/, 'footer line');
  assert.equal(bare.match(/Nothing known yet/g).length, 2, 'Character and Background');
  assert.match(bare, /No appearance established yet/, 'Appearance keeps main\'s own wording');
  assert.doesNotMatch(bare, /Looks/);
  const aged = dossierProfileHtml({ name: 'Ada', age: '19', apparentAge: '~25' }, {});
  assert.match(aged, /<b>Age<\/b><span>19</);
  const apparent = dossierProfileHtml({ name: 'Ada', apparentAge: '~25' }, {});
  assert.match(apparent, /<b>Age<\/b><span>~25</);
  assert.match(dossierProfileHtml({ name: 'Ada', apparentAge: '25' }, {}), /Age ~25/, 'a bare apparent age gets the tilde');
  assert.doesNotMatch(apparent, /Looks/);
  const fc = (field) => ({ fieldChanges: { latest: [field], latestTurn: 3, message: 12 } });
  assert.doesNotMatch(dossierProfileHtml({ name: 'Ada', age: '19', apparentAge: '~25', ...fc('apparentAge') }, {}), /delta-changed-mark/, 'the mark follows the shown real age, which did not change');
  assert.match(dossierProfileHtml({ name: 'Ada', apparentAge: '~25', ...fc('apparentAge') }, {}), /delta-changed-mark/, 'the shown apparent age changed: marked');
  assert.match(dossierProfileHtml({ name: 'Ada', age: '19', ...fc('age') }, {}), /delta-changed-mark/);
  assert.match(sectionsCss, /\.delta-board-meters \{ font-weight:700; \}/, 'the caption meter line is bold as in the mockup');
  const caption = boardHtml({ ...rika, role: 'F-rank mage' }, {});
  assert.match(caption, /delta-board-role[^>]*>F-rank mage</);
  assert.match(caption, /<i data-axis="trust">Trust \+11<\/i><i data-axis="affection">Affection \+10<\/i><i data-axis="desire">Desire \+6<\/i><i data-axis="tension">Tension \+13<\/i>/);
});
