// Builds the Profile page: who they are, looks, character (personality, speech, habits) and background; unknown gender is flagged.
import { h } from '../../../kit/dom.js';
import { kvList, pageSection } from '../../../kit/page.js';

/** Words the gender row: Male or Female as written, or a flag that it is not stated and only a hand edit can set it. */
export function genderWords(d) {
  if (d.genderUnknown || !d.profile?.gender) return h('span', { class: 'gflag' }, 'Not stated · set it in Edit');
  return d.profile.gender;
}

/** Builds the Profile page; empty sections are left out. */
export function profilePage(d) {
  const p = d.profile ?? {};
  const habits = p.habits?.length ? h('ul', { class: 'pl' }, p.habits.map(x => h('li', null, x))) : null;
  return [
    pageSection('Who', kvList([['Species', p.species], ['Gender', genderWords(d)], ['Age', p.age], ['Home', p.home], ['Aliases', p.aliases]])),
    pageSection('Looks', p.looks ? h('p', null, p.looks) : null),
    pageSection('Character', kvList([['Personality', p.personality], ['Speech', p.speech], ['Habits', habits]])),
    pageSection('Background', p.background ? h('p', null, p.background) : null),
  ].filter(Boolean);
}
