// Builds the Right now page (where, doing, wearing, thinking, or last seen) with the shared scene-spoiler switch, and the Mood page.
import { h } from '../../../kit/dom.js';
import { kvList, pageSection } from '../../../kit/page.js';
import { spoilerSwitch, hiddenValue } from '../../../kit/spoiler.js';

const quote = text => (text ? h('span', { class: 'q' }, `“${text}”`) : null);

/** Returns true when the person is in the scene (the view-model carries `where`), false for a last-known place. */
function isHere(now) {
  return Boolean(now) && Object.hasOwn(now, 'where');
}

/** Builds the Right now page; the Wants and Hiding rows sit behind the scene switch, shared with Now through ctx.prefs ('scene'). */
export function nowPage(d, ctx = {}) {
  const now = d.now ?? {};
  const facts = isHere(now)
    ? kvList([['Where', now.where], ['Doing', now.doing], ['Wearing', now.wearing], ['Thinking', quote(now.thought)]])
    : kvList([['Last known place', now.lastPlace], ['Last seen', now.lastSeen ?? 'not known'], ['Said', now.said ? h('span', { class: 'q' }, now.said) : null]]);
  const out = h('div', { class: 'dpage-now' }, facts);
  if (!d.scene) return out;
  let shown = Boolean(ctx.prefs?.getSpoiler?.('scene'));
  const rows = h('div', { class: 'scene-rows' });
  const draw = () => rows.replaceChildren(...[kvList([['Wants', hiddenValue(d.scene.wants, shown)], ['Hiding', hiddenValue(d.scene.hiding, shown)]])].filter(Boolean));
  draw();
  out.appendChild(spoilerSwitch({
    id: 'dossier-scene-spoiler', title: 'Scene spoilers', hint: 'what they want and hide right now · same switch as Now · per chat', checked: shown,
    onChange: (next) => { shown = ctx.prefs?.setSpoiler ? ctx.prefs.setSpoiler('scene', next) : next; draw(); },
  }));
  out.appendChild(rows);
  return out;
}

/** Builds the Mood page: the mood word, or a dash when none is known. */
export function moodPage(d) {
  return pageSection(null, h('div', { class: 'bigw' }, d.mood || '—'), d.mood ? null : h('p', { class: 'fine' }, 'No mood has been read yet.'));
}
