// The People page's last groups from mock v7: Refresh and the narrator and Portraits, each row tied to its NPC State setting
// (Refresh every and NPCs refreshed per reply are N8's rolling Refresh: narrationCaptureCatchUp and narrationCaptureCatchUpPeople).
import { intRow, swRow } from './kit.js';
import { portraitRows } from './portraits.js';

/** N8's rolling Refresh: each person waits this many replies between Refreshes, and 0 (as stored, not a blank) turns it off. */
const zeroOff = r => ({ ...r, write: (v, b) => (v === 0 || v === '0' ? [[r.store, 0]] : r.write(v, b)) });

/** Returns the rows of Refresh and the narrator and Portraits. */
export function runRows() {
  return [
    swRow('Refresh and the narrator', 'onePassCapture', 'One-pass capture', 'narrationCapture', true, { hint: 'The narrator writes NPC State’s changes in its reply; off = background scans' }),
    zeroOff(intRow('Refresh and the narrator', 'refreshEvery', 'Refresh every', 'narrationCaptureCatchUp', 4, { min: 0, max: 50, unit: 'replies', tags: ['replaced:D13', 'cost:model call'], hint: 'Applies when one-pass capture is on. Re-reads the recent story for the people seen most; replaces the event scan and the every-5 safety scan' })),
    intRow('Refresh and the narrator', 'npcsRefreshedPerReply', 'NPCs refreshed per reply', 'narrationCaptureCatchUpPeople', 1, { min: 1, max: 3, unit: 'people', tags: ['cost:model call'], hint: 'Applies when one-pass capture is on. The most people one reply may Refresh (1 to 3); nobody is taken twice inside the wait' }),
    intRow('Refresh and the narrator', 'refreshReadsBack', 'Refresh reads back', 'scanDepth', 6, { min: 2, max: 30, unit: 'messages', hint: 'How much recent story each Refresh reads' }),
    intRow('Refresh and the narrator', 'peopleTheNarratorIsToldA', 'People the narrator is told about', 'injectLimit', 3, { min: 1, max: 12, tags: ['cost:tokens'], hint: 'Most present people in the prompt each reply' }),
    intRow('Refresh and the narrator', 'peopleBlockBudget', 'People block budget', 'injectBudgetTokens', 4000, { min: 512, max: 6000, unit: 'tokens', tags: ['cost:tokens'], hint: 'Kept separate from the notes budget, as today' }),
    intRow('Refresh and the narrator', 'mostPeopleKeptActive', 'Most people kept active', 'maxNpcs', 40, { min: 1, max: 100 }),
    ...portraitRows(),
  ];
}
