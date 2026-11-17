// The People page's last groups from mock v7: Refresh and the narrator, Portraits and Map, each row tied to its NPC State setting
// (Refresh every and NPCs refreshed per reply are N8's rolling Refresh: narrationCaptureCatchUp and narrationCaptureCatchUpPeople).
import { intRow, swRow, segRow } from './kit.js';
import { shownRow } from './kit-more.js';

const text = (b, key, dflt = '') => (typeof b[key] === 'string' ? b[key] : dflt);
const yes = (b, key, dflt) => (b[key] === undefined ? dflt : b[key] === true);
const LENSES = [['Warmth', 'warmth'], ['Trust', 'trust'], ['Affection', 'affection'], ['Desire', 'desire'], ['Tension', 'tension']];

/** N8's rolling Refresh: each person waits this many replies between Refreshes, and 0 (as stored, not a blank) turns it off. */
const zeroOff = r => ({ ...r, write: (v, b) => (v === 0 || v === '0' ? [[r.store, 0]] : r.write(v, b)) });

const MAP = { enabled: true, defaultLens: 'warmth' };
/** One half of the map's settings object: reads its field, and a change keeps the other half (as the old panel's patch does). */
const mapRow = (row, field, make, show) => ({ ...row, store: 'relationshipMap', reset: field === 'enabled' ? [['relationshipMap', { ...MAP }]] : [], read: b => show((b.relationshipMap ?? MAP)[field] ?? MAP[field]), write: (v, b) => [['relationshipMap', { ...MAP, ...(b.relationshipMap ?? {}), [field]: make(v) }]] });

/** Returns the rows of Refresh and the narrator, Portraits and Map. */
export function runRows() {
  return [
    zeroOff(intRow('Refresh and the narrator', 'refreshEvery', 'Refresh every', 'narrationCaptureCatchUp', 4, { min: 0, max: 50, unit: 'replies', tags: ['replaced:D13', 'cost:model call'], hint: 'Re-reads the recent story for the people seen most; replaces the event scan and the every-5 safety scan' })),
    intRow('Refresh and the narrator', 'npcsRefreshedPerReply', 'NPCs refreshed per reply', 'narrationCaptureCatchUpPeople', 1, { min: 1, max: 3, unit: 'people', tags: ['cost:model call'], hint: 'The most people one reply may Refresh (1 to 3); nobody is taken twice inside the wait' }),
    intRow('Refresh and the narrator', 'refreshReadsBack', 'Refresh reads back', 'scanDepth', 6, { min: 2, max: 30, unit: 'messages', hint: 'How much recent story each Refresh reads' }),
    swRow('Refresh and the narrator', 'shortOnePassInstruction', 'Short one-pass instruction', 'narrationCaptureCompact', false),
    intRow('Refresh and the narrator', 'peopleTheNarratorIsToldA', 'People the narrator is told about', 'injectLimit', 3, { min: 1, max: 12, tags: ['cost:tokens'], hint: 'Most present people in the prompt each reply' }),
    intRow('Refresh and the narrator', 'peopleBlockBudget', 'People block budget', 'injectBudgetTokens', 4000, { min: 512, max: 6000, unit: 'tokens', tags: ['cost:tokens'], hint: 'Kept separate from the notes budget, as today' }),
    intRow('Refresh and the narrator', 'mostPeopleKeptActive', 'Most people kept active', 'maxNpcs', 40, { min: 1, max: 100 }),
    swRow('Portraits', 'portraits', 'Generate portraits', 'portraitGenerationEnabled', true),
    shownRow('Portraits', 'stylePreset', 'Style preset', b => (b.portraitThemePreset === 'custom' ? 'Custom' : 'Fantasy Anime'), { hint: 'Fantasy Anime is the built-in one' }),
    shownRow('Portraits', 'prompt', 'Prompt', b => text(b, 'portraitStylePositive'), { hint: 'The style text added to every portrait' }),
    shownRow('Portraits', 'leaveOut', 'Leave out', b => text(b, 'portraitStyleNegative')),
    shownRow('Portraits', 'composition', 'Composition', b => text(b, 'portraitComposition')),
    shownRow('Portraits', 'promptFormat', 'Prompt format', b => ({ tags: 'Comma tags', natural: 'Natural language' })[b.portraitPromptFormat] ?? 'Structured hybrid', { hint: 'A character card can recommend one' }),
    shownRow('Portraits', 'savedPortraitPresets', 'Saved portrait presets', b => `${(b.portraitCustomPresets ?? []).length} of 24 saved`),
    shownRow('Portraits', 'useTheCurrentMood', 'Use the current mood', b => (yes(b, 'portraitUseMood', true) ? 'on' : 'off')),
    shownRow('Portraits', 'useTheCurrentPlace', 'Use the current place', b => (yes(b, 'portraitUseLocation', false) ? 'on' : 'off')),
    shownRow('Portraits', 'alsoSaveToSillytavernSGa', 'Also save to SillyTavern’s gallery', b => (yes(b, 'portraitSaveToGallery', false) ? 'on' : 'off')),
    mapRow(swRow('Map', 'relationshipMap', 'Relationship map', 'relationshipMap', true, { hint: 'Adds a Map view to the dossier panel; read-only' }), 'enabled', Boolean, v => v !== false),
    mapRow(segRow('Map', 'defaultDistance', 'Default distance', 'relationshipMap', 'warmth', LENSES, { hint: 'What the map’s distance shows when it opens; the buttons on the map change it for this session only' }), 'defaultLens', v => (LENSES.find(p => p[0] === v) ?? LENSES[0])[1], v => (LENSES.find(p => p[1] === v) ?? LENSES[0])[0]),
  ];
}
