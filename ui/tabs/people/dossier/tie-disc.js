// Builds a tie's round portrait (image, person glyph or initial letter) for the dossier Ties card and page.
import { h, svgEl } from '../../../kit/dom.js';
import { isSafePortraitUrl } from '../../../kit/safe-url.js';

/** First letter of the last word of a tie's name, upper case ("Old Sera Vane" gives V); "?" when there is no name. */
export function tieInitial(tie) {
  return String(tie?.name ?? '?').trim().split(/\s+/).pop().slice(0, 1).toUpperCase();
}

/** True for a tie known only by a role ("the Harbour Master"), which gets the person glyph, not a letter. */
export function isNamelessTie(tie) {
  return /^the /i.test(String(tie?.name ?? ''));
}

function personGlyph() {
  return svgEl('svg', { class: 'glyph', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
    svgEl('circle', { cx: 12, cy: 8, r: 4 }), svgEl('path', { d: 'M4 21c0-4.5 3.6-8 8-8s8 3.5 8 8z' }));
}

/** Builds a tie's round portrait: the image when the tie has a safe portrait URL, else a person glyph (nameless tie) or the initial. */
export function tieDisc(tie, className = 'a') {
  const src = tie?.portrait;
  const style = isSafePortraitUrl(src) ? { 'background-image': `url("${src}")` } : null;
  const face = style ? null : (isNamelessTie(tie) ? personGlyph() : tieInitial(tie));
  return h('span', { class: className, style, dataset: { portrait: src ?? null } }, face);
}
