// Provides the suite's SVG glyph set as structured path data and an element builder.
import { svgEl } from './dom.js';

export const GLYPHS = Object.freeze({
  // Tabs
  now: [['path', { d: 'M12 3 2 11h3v9h5v-6h4v6h5v-9h3z' }]],
  party: [
    ['circle', { cx: 8, cy: 7, r: 3 }],
    ['path', { d: 'M2 20c0-4 2.7-7 6-7s6 3 6 7z' }],
    ['circle', { cx: 17, cy: 8, r: 2.4 }],
    ['path', { d: 'M13.5 20c.3-3.5 1.8-6 3.5-6 2.4 0 4.5 2.6 4.5 6z' }],
  ],
  bag: [
    ['path', { d: 'M5 8h14l1.2 13H3.8z' }],
    ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, d: 'M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8' }],
  ],
  people: [
    ['path', { d: 'M3 4h18v16H3z' }],
    ['circle', { cx: 9, cy: 11, r: 2.6, fill: 'var(--su-panel2)' }],
  ],
  world: [
    ['circle', { cx: 12, cy: 12, r: 9.5 }],
    ['path', { d: 'M3 12h18M12 2.5c2.6 2.8 4 6 4 9.5s-1.4 6.7-4 9.5c-2.6-2.8-4-6-4-9.5s1.4-6.7 4-9.5z', fill: 'none', stroke: 'var(--su-panel2)', 'stroke-width': 1.6 }],
  ],
  journal: [['path', { d: 'M5 3h13a1 1 0 0 1 1 1v17H7a2 2 0 0 1-2-2z' }]],
  story: [
    ['path', { d: 'M3 8h18v12H3z' }],
    ['path', { d: 'm3 7 2.5-4h4L7 7zm7 0 2.5-4h4L14 7zm7 0 2.5-4H21v4z' }],
  ],
  fight: [
    ['path', { d: 'M12 2C7 2 4 5.5 4 10c0 2.6 1.2 4.4 3 5.5V19a2 2 0 0 0 2 2h1v-2h1.5v2h1v-2H14v2h1a2 2 0 0 0 2-2v-3.5c1.8-1.1 3-2.9 3-5.5 0-4.5-3-8-8-8zM9 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z' }],
  ],

  // Now & changes
  key: [['path', { d: 'M14 4a6 6 0 1 0 3.9 10.6L21 17.7V21h-3v-2h-2v-2h-2l-1.3-1.3A6 6 0 0 0 14 4zm-1 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', transform: 'translate(-3 -1)' }]],
  coin: [['circle', { cx: 12, cy: 12, r: 9 }]],
  quest: [['path', { d: 'M6 2h10l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z' }]],
  heart: [['path', { d: 'M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z' }]],
  news: [['path', { d: 'M3 5h14v13a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2zm16 3h2v10a2 2 0 0 1-2 2z' }]],
  clock: [
    ['circle', { cx: 12, cy: 12, r: 9.5 }],
    ['path', { fill: 'none', stroke: 'var(--su-panel2)', 'stroke-width': 2.2, 'stroke-linecap': 'round', d: 'M12 6.5V12l3.5 2' }],
  ],
  warn: [['path', { d: 'M12 2 1 21h22z' }]],
  info: [['circle', { cx: 12, cy: 12, r: 9 }]],
  road: [['path', { d: 'M9 2h2l-1 20H6zM13 2h2l3 20h-4z' }]],
  item: [['path', { d: 'M5 8h14l1.2 13H3.8z' }]],

  // Equipment slots & skills
  head: [
    ['path', { d: 'M4 15a8 8 0 0 1 16 0v3H4z' }],
    ['path', { d: 'M9 18v3h6v-3', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }],
  ],
  armor: [['path', { d: 'M8 3 4 6v6l2 1v8h12v-8l2-1V6l-4-3c-1 2-2.4 3-4 3s-3-1-4-3z' }]],
  cloak: [['path', { d: 'M9 3h6l1 4 4 14H4L8 7z' }]],
  feet: [['path', { d: 'M7 3h5v9l7 3c1 .5 1.5 1.5 1.5 2.5V21H5V12z' }]],
  mount: [['path', { d: 'M5 9 13 9 15.5 5.5 16.5 2.5 18 4.2 20 5 22 9 20.5 10 18.5 8.5 16.5 11.5 16.2 15 16.8 21.5 14.8 21.5 14 15.8 9 15.8 8.8 21.5 6.8 21.5 6 14.5 4.5 13 2.5 14 3 10z' }]],
  weapon: [
    ['path', { d: 'M14.5 2.5H21v6.5L10 20l-6.5-6.5z' }],
    ['path', { d: 'M3 18l3 3', stroke: 'currentColor', 'stroke-width': 2.4 }],
  ],
  offhand: [['path', { d: 'M12 2.5l8 3v6c0 5.5-3.5 9-8 11-4.5-2-8-5.5-8-11v-6z' }]],
  accessory: [
    ['circle', { cx: 12, cy: 14, r: 6.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6 }],
    ['path', { d: 'M9.5 3h5l-1.5 4.5h-2z' }],
  ],
  bagslot: [
    ['path', { d: 'M6 8h12l1 13H5z' }],
    ['path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, d: 'M9 8V6a3 3 0 0 1 6 0v2' }],
  ],
  atk: [['path', { d: 'M14.5 2.5H21v6.5L10 20l-6.5-6.5z' }]],
  area: [
    ['circle', { cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }],
    ['circle', { cx: 12, cy: 12, r: 4 }],
  ],
  heal: [['path', { d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' }]],
  stance: [['path', { d: 'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z' }]],
  bolt: [['path', { d: 'M13 2 4 14h7l-1 8 9-12h-7z' }]],
  crack: [['path', { d: 'M13 2 8 11h4l-2 11 7-13h-4z' }]],

  // Bag kinds, assets & tools
  use: [['path', { d: 'M9 2h6v2h-1v4.2l5.3 9.2A3 3 0 0 1 16.7 22H7.3a3 3 0 0 1-2.6-4.6L10 8.2V4H9z' }]],
  goods: [
    ['path', { d: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z' }],
    ['path', { d: 'M3 7.5l9 4.5 9-4.5M12 12v9', fill: 'none', stroke: 'var(--su-panel2)', 'stroke-width': 1.6 }],
  ],
  material: [
    ['path', { d: 'M3 15l3.5-7.5L13 4l7 4.5L21 16l-5.5 4.5H8z' }],
    ['path', { d: 'M6.5 7.5 11 12l2-8M11 12l4.5 8.5M11 12l10 4', fill: 'none', stroke: 'var(--su-panel2)', 'stroke-width': 1.4 }],
  ],
  house: [['path', { d: 'M12 3 2 11h3v10h5v-6h4v6h5V11h3z' }]],
  cart: [
    ['path', { d: 'M2 6h14v9H2z' }],
    ['path', { d: 'M16 9h3l3 3v3h-6z' }],
    ['circle', { cx: 6, cy: 18, r: 2.5 }],
    ['circle', { cx: 18, cy: 18, r: 2.5 }],
  ],
  boat: [
    ['path', { d: 'M2 13h20l-3 6H5z' }],
    ['path', { d: 'M11 3v9H5z' }],
    ['path', { d: 'M13 5l5 7h-5z' }],
  ],
  search: [
    ['circle', { cx: 10.5, cy: 10.5, r: 6.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }],
    ['path', { d: 'm15.5 15.5 5 5', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round' }],
  ],

  // World places, map tools & factions
  town: [['path', { d: 'M3 21V10l5-4 5 4v11zM13 21V7l4-3 4 3v14z' }]],
  port: [
    ['path', { d: 'M12 2v14M7 6h10M4 13c0 4 3.6 7 8 7s8-3 8-7' }],
    ['circle', { cx: 12, cy: 4, r: 2 }],
  ],
  village: [['path', { d: 'M3 21v-9l9-7 9 7v9h-6v-6H9v6z' }]],
  ford: [['path', { d: 'M2 9c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1M2 15c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }]],
  outpost: [['path', { d: 'M4 21 12 4l8 17z' }]],
  tower: [['path', { d: 'M7 21V8l-2-4h4v2h2V4h2v2h2V4h4l-2 4v13z' }]],
  ruin: [['path', { d: 'M3 21v-6h3v-4h3v10zM12 21V9h3V6h3v15zM8 7l2-3 2 3z' }]],
  city: [['path', { d: 'M2 21V11h4V7h3v14zM10 21V4h5v17zM16 21v-9h6v9z' }]],
  plus: [['path', { d: 'M11 4h2v16h-2zM4 11h16v2H4z' }]],
  minus: [['path', { d: 'M4 11h16v2H4z' }]],
  fit: [['path', { d: 'M3 3h7v2H5v5H3zM14 3h7v7h-2V5h-5zM3 14h2v5h5v2H3zM19 14h2v7h-7v-2h5z' }]],
  me: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    ['path', { d: 'M11 1h2v5h-2zM11 18h2v5h-2zM1 11h5v2H1zM18 11h5v2h-5z' }],
  ],
  tidy: [['path', { d: 'M4 6h16v2H4zM4 11h10v2H4zM4 16h13v2H4z' }]],
  guild: [['path', { d: 'M12 2l9 4v2H3V6zM5 10h2v8H5zm6 0h2v8h-2zm6 0h2v8h-2zM3 20h18v2H3z' }]],
  cord: [['path', { d: 'M12 3a5 5 0 0 1 5 5c0 4-5 6-5 13-0-7-5-9-5-13a5 5 0 0 1 5-5z' }]],
  sail: [['path', { d: 'M11 2v15H4zM13 5l7 12h-7zM3 19h18l-2 3H5z' }]],
  mask: [['path', { d: 'M3 6c3-1 6-1 9 1 3-2 6-2 9-1 0 7-3 12-9 12S3 13 3 6zm4 4c1 1 2.5 1 3.5 0-1-1.5-2.5-1.5-3.5 0zm6.5 0c1 1 2.5 1 3.5 0-1-1.5-2.5-1.5-3.5 0z' }]],
  chapel: [['path', { d: 'M11 2h2v3h3v2h-3v2l6 4v9H5v-9l6-4V7H8V5h3z' }]],
});

/** Builds an SVG element for a named glyph, or returns null when the name is unknown. */
export function glyph(name, opts = {}) {
  const shapes = GLYPHS[name];
  if (!shapes) return null;
  const { size, className, label, fill = 'currentColor' } = opts;
  return svgEl(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill,
      class: className ?? null,
      width: size ?? null,
      height: size ?? null,
      role: label ? 'img' : null,
      'aria-label': label ?? null,
      'aria-hidden': label ? null : 'true',
    },
    shapes.map(([tag, attrs]) => svgEl(tag, attrs)),
  );
}
