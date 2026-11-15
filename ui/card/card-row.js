// Builds the card's top row: ‹ Story, time · place · weather (opens the Scene sheet) and ⚙.
import { h } from '../kit/dom.js';
import { glyph } from '../kit/glyphs.js';

// The glyph set has no weather or place pin yet, so those fall back to the nearest name (null = none).
const GLYPH = { town: 'town', weather: 'none' };

function part(name, text) {
  if (!text) return null;
  return h('span', { class: `meta-${name}` }, glyph(GLYPH[name] ?? name), h('span', text));
}

/** Creates the row from the card's scene and the onBack, onScene and onSettings handlers. */
export function cardRow(scene = {}, handlers = {}) {
  const { onBack, onScene, onSettings } = handlers;
  const when = [scene.time, [scene.date, scene.weekday].filter(Boolean).join(', ')]
    .filter(Boolean).join(' · ');
  const open = event => { if (onScene) onScene(event); };
  return h(
    'div',
    { class: 'ctop' },
    h('button', { type: 'button', class: 'bk', onClick: onBack }, '‹ Story'),
    h(
      'div',
      {
        class: 'meta',
        role: 'button',
        tabindex: '0',
        'aria-haspopup': 'dialog',
        'aria-label': 'Scene: time, place, weather, who is here',
        onClick: open,
        onKeydown: event => {
          if (event.key === 'Enter' || event.key === ' ') open(event);
        },
      },
      part('clock', when),
      part('town', scene.place),
      part('weather', scene.weather),
    ),
    h('button', { type: 'button', class: 'ibtn', title: 'Settings', 'aria-label': 'Settings', onClick: onSettings }, '⚙'),
  );
}
