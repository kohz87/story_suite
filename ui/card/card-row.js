// Builds the card's top row: ‹ Chat, time · place · weather (opens the Scene sheet) and ⚙.
import { h, svgEl } from '../kit/dom.js';


// The mock's own clock, pin and cloud glyphs (stroke style), kept here because the shared set has no pin or weather.
const ICONS = {
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  town: [['path', { d: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z' }], ['circle', { cx: 12, cy: 9.5, r: 2.5 }]],
  weather: [['path', { d: 'M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z' }], ['path', { d: 'M8 21l1-2M12 21l1-2M16 21l1-2' }]],
};
const TEXT_CLASS = { clock: 'tm', town: 'pl2' };

function icon(name) {
  return svgEl(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'aria-hidden': 'true' },
    ICONS[name].map(([tag, attrs]) => svgEl(tag, attrs)),
  );
}

function part(name, text) {
  if (!text) return null;
  return h('span', { class: `meta-${name}` }, icon(name), h('span', { class: TEXT_CLASS[name] ?? null }, text));
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
    h('button', { type: 'button', class: 'bk', onClick: onBack }, '‹ Chat'),
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
