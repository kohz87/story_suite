// Builds the dossier's portrait column: the ring with its four labels, the name, ★ Following and the mood chip, the who-line, the meter line and where they are (the dead get their badge).
import { h } from '../../../kit/dom.js';
import { FEELING_KEYS } from '../../../kit/ring.js';
import { feelingsHero } from './feelings.js';
import { partyAddButton } from './party-add.js';
import { isSafePortraitUrl } from '../../../kit/safe-url.js';

const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : '');
const signed = n => (n > 0 ? `+${n}` : String(n));

/** "Trust +3 · Affection +1 · Desire 0 · Tension 0", each in its feeling's colour. */
export function meterLine(meters = {}) {
  return h('div', { class: 'mets' }, FEELING_KEYS.flatMap((key, i) => [i ? ' · ' : null, h('span', { class: `f${i}` }, `${cap(key)} ${signed(Number(meters?.[key]) || 0)}`)]).filter(Boolean));
}

/**
 * Builds the column for dossier `d`. opts = { following, onFollow(), onProfile(), party: the Add to party context (ctx plus onAdded / onEdited) }.
 * Where: "Here · place" for someone in the scene, else their last place; the dead show where they died.
 */
export function dossierHero(d, { following = false, onFollow, onProfile, party = null, profileOpen = false } = {}) {
  const dead = d.life !== 'alive';
  const here = !dead && d.now && Object.hasOwn(d.now, 'where');
  const place = dead ? (d.death?.where ?? '') : (here ? d.now.where : (d.now?.lastPlace ?? ''));
  const where = [here ? 'Here' : null, place, d.inParty ? 'in your party' : null].filter(Boolean).join(' · ');
  const chips = dead
    ? [h('span', { class: ['deadb', d.life === 'presumed' ? 'pres' : null] }, d.life === 'presumed' ? 'Presumed dead' : 'Deceased')]
    // (the chip is small, the button round it is a 44 px tap)
    : [h('button', { type: 'button', class: 'fbtn', 'aria-pressed': String(following), dataset: { act: 'follow' }, onClick: () => onFollow?.() }, h('span', { class: ['chip', following ? 'pres' : null] }, following ? '★ Following' : '☆ Follow')),
      d.mood ? h('span', { class: 'chip' }, d.mood) : null];
  // (with the Profile part open, the portrait fills this column on a tablet or desktop window; dossier.css hides it on a phone, where the Profile page shows it: owner, 20 Nov)
  const full = profileOpen && isSafePortraitUrl(d.portrait) ? h('div', { class: 'dhfull' }, h('img', { src: d.portrait, alt: `${d.name ?? ''}, portrait` })) : null;
  return h('section', { class: ['dhero', full ? 'pfopen' : null] }, full,
    feelingsHero(d, { onProfile }),
    h('div', { class: 'dname' }, d.name),
    h('div', { class: 'chips dchips' }, chips.filter(Boolean)),
    h('div', { class: 'idl' }, d.idLine, d.genderUnknown ? h('span', { class: 'gflag' }, `${d.idLine ? ' · ' : ''}gender not stated`) : null),
    dead ? null : meterLine(d.meters),
    where ? h('div', { class: 'where' }, where) : null,
    dead || !party ? null : partyAddButton(d, party));
}
