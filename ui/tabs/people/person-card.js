// Builds one person tile for the People list (feelings ring, mood, where or last seen, last said) and the portrait disc the map reuses.
import { h } from '../../kit/dom.js';
import { feelingsRing } from '../../kit/ring.js';
import { glyph } from '../../kit/glyphs.js';
import { isSafePortraitUrl } from '../../kit/safe-url.js';

const TITLES = /^(Sister|Captain|Old) /;
// Only a phrase is lowered to run on in the line ("At the Gull" → "at the Gull", "The toll gate", "North road"): a leading little word followed by a
// lower-case word. A place's own name keeps its capital ("Bluewatch Village", "The Glass Pits", "North Pass").
const PHRASE_START = /^(?:at|on|in|inside|outside|near|by|behind|beside|under|along|across|towards?|the|a|an|somewhere|north|south|east|west)$/i;
const phrase = text => { const [first, next] = String(text).split(/\s+/); return PHRASE_START.test(first ?? '') && /^\p{Ll}/u.test(next ?? ''); };
const lower = text => (text && phrase(text) ? text[0].toLowerCase() + text.slice(1) : text);

/** First letter of the name without a title (Sister, Captain, Old), shown when there is no portrait. */
export function initialOf(person) {
  return String(person?.name ?? '?').replace(TITLES, '').slice(0, 1);
}

/** Builds the round portrait: a background image for a safe URL, otherwise the initial. */
export function portraitDisc(person, className = 'ph') {
  const src = person.portrait;
  const style = isSafePortraitUrl(src) ? { 'background-image': `url("${src}")` } : null;
  return h('span', { class: className, style, dataset: { portrait: src ?? null } }, style ? null : initialOf(person));
}

function whereLine(person, kind) {
  if (kind === 'here') return person.where ?? '';
  if (kind === 'dormant') return 'not seen lately';
  if (kind === 'deceased') return person.death ? `Died ${person.death.when}` : (person.where ?? '');
  const place = lower(person.lastPlace ?? person.where ?? '');
  return [place, person.lastSeen ? `last seen ${person.lastSeen}` : '', person.back ? `back ${person.back}` : ''].filter(Boolean).join(' · ');
}

/** Builds a tile button; kind is 'here', 'elsewhere', 'deceased' or 'dormant'; onOpen(personId) opens the dossier. */
export function personCard(person, { kind = 'here', onOpen } = {}) {
  const dead = kind === 'deceased';
  const living = !dead && kind !== 'dormant';
  return h(
    'button',
    {
      type: 'button',
      class: ['pc', dead ? 'dead' : null],
      dataset: { personId: person.personId, kind },
      onClick: () => onOpen?.(person.personId),
    },
    h('span', { class: 'prg' },
      dead ? null : feelingsRing(person.meters, { width: 6 }),
      portraitDisc(person),
      person.followed ? h('span', { class: 'star', title: 'Followed' }, '★') : null,
      person.inParty ? h('span', { class: 'pty', title: 'In your party' }, glyph('party')) : null),
    h('span', { class: 'nm2' }, person.name),
    living && person.mood ? h('span', { class: 'md2' }, person.mood) : null,
    h('span', { class: 'wh' }, whereLine(person, kind)),
    kind === 'elsewhere' && (person.said || person.doing) ? h('span', { class: 'sd' }, person.said || person.doing) : null,
  );
}
