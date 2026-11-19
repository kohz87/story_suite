// Builds the Right now part (where, doing, wearing, thinking, or last seen) with the shared scene-spoiler switch, and the Mood part with its recent changes.
import { h } from '../../../kit/dom.js';
import { kvList, pageSection } from '../../../kit/page.js';
import { moodMeters, moodMove } from './mood-meters.js';
import { eventRow } from './reply-words.js';
import { spoilerSwitch, hiddenValue } from '../../../kit/spoiler.js';

const quote = text => (text ? h('span', { class: 'q' }, `“${text}”`) : null);

/** Returns true when the person is in the scene (the view-model carries `where`), false for a last-known place. */
function isHere(now) {
  return Boolean(now) && Object.hasOwn(now, 'where');
}

/** Builds the Right now page; the Wants and Hiding rows sit behind the scene switch, shared with Now through ctx.prefs ('scene'). */
export function nowPage(d, ctx = {}) {
  const now = d.now ?? {};
  // (each fact its own titled section, as the mock draws them)
  const rows = isHere(now)
    ? [['Where', now.where], ['Doing', now.doing], ['Wearing', now.wearing], ['Thinking', quote(now.thought)]]
    : [['Last known place', now.lastPlace], ['Last seen', now.lastSeen ?? 'not known'], ['Said', now.said ? h('span', { class: 'q' }, now.said) : null]];
  const out = h('div', { class: 'dpage-now' }, rows.filter(([, value]) => value).map(([title, value]) => pageSection(title, h('p', null, value))));
  if (!d.scene) return out;
  let shown = Boolean(ctx.prefs?.getSpoiler?.('scene'));
  const scene = h('div', { class: 'scene-rows' });
  const draw = () => scene.replaceChildren(...[kvList([['Wants', d.scene.wants ? hiddenValue(d.scene.wants, shown) : null], ['Hiding', d.scene.hiding ? hiddenValue(d.scene.hiding, shown) : null]])].filter(Boolean));
  draw();
  out.appendChild(spoilerSwitch({
    id: 'dossier-scene-spoiler', title: 'Scene spoilers', hint: 'what they want and hide right now · per chat', checked: shown,
    onChange: (next) => { shown = ctx.prefs?.setSpoiler ? ctx.prefs.setSpoiler('scene', next) : next; draw(); },
  }));
  out.appendChild(scene);
  return out;
}

/** Builds the Mood part: the mood word (a dash when none is known) and its three meters, then Recent changes: each with its date, reply, the axes moved and the recorded reason (none shown when none was recorded). */
export function moodPage(d) {
  const changes = d.moodChanges ?? [];
  return [
    pageSection(null, h('div', { class: 'row' }, h('span', { class: 'fine' }, 'Mood'), h('b', { class: 'bigw' }, d.mood ? d.mood[0].toUpperCase() + d.mood.slice(1) : '—')), moodMeters(d.moodBars),
      d.mood ? null : h('p', { class: 'fine' }, 'No mood has been read yet.')),
    d.mood ? pageSection('Recent changes', changes.length
      ? h('div', { class: 'evs' }, changes.map(c => eventRow(c.reply, c.date, ...moodMove(c.moves), c.why ? ` · ${c.why}` : null)))
      : h('p', { class: 'fine' }, 'No change recorded yet.')) : null,
  ].filter(Boolean);
}
