// Builds the Models page's three connection cards from the host settings and the Connection Manager's profile list.

import { profileChoices } from '../../core/model-call/profile-field.js';
import { ROLE_SETTING } from '../../core/model-call/connection-for.js';

const CARDS = [
  { id: 'story', name: 'Story', desc: 'Follows the chat’s connection; change it in SillyTavern', usedFor: ['narration', 'change lines', 'pulse ideas (inside the reply)'] },
  { id: 'quick', name: 'Quick helpers', desc: 'Short calls the reply waits for: keep this fast', usedFor: ['checks rolled before the reply (up to 20 s)', 'fight set-up from your attack (up to 20 s)', 'cast moves (waits up to 15 s)', 'the Assist safety net (reads changes a reply forgot)', 'the fight pre-check (before a fight starts)'] },
  { id: 'background', name: 'Background', desc: 'Calls nobody waits on; they run behind the others', usedFor: ['new-person fill-in (with hidden notes)', 'Refresh', 'the fallback call (only when a reply forgot its lines)', 'arc plans (never started while a reply is sent)'] },
];

/**
 * `host`: the host settings (the Quick and Background profile names); `list`: listProfiles()'s answer (or null when it was not read).
 * → the contract's `connections`: Story is read-only; the other two carry their dropdown (`options`, `value` = the stored name, '' for the chat's)
 * and the one-line `note` (no profiles, Connection Manager off, or the stored profile gone).
 */
export function selectConnections(host, list) {
  return CARDS.map(card => {
    if (card.id === 'story') return { ...card, choice: 'The chat’s own', value: '', options: [], readOnly: true, usedFor: [...card.usedFor] };
    const { options, selected, note } = profileChoices(host?.[ROLE_SETTING[card.id]], list ?? undefined);
    const shown = options.find(o => o.value === selected);
    return { ...card, choice: shown ? shown.label : selected, value: selected, options, note, readOnly: false, usedFor: [...card.usedFor] };
  });
}
