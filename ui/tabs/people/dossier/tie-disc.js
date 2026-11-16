// Builds a tie's round portrait (image or initial letter) for the dossier Ties card and page.
import { h } from '../../../kit/dom.js';

/** First letter of a tie's name, upper case, without a leading "the" ("the Harbour Master" gives H). */
export function tieInitial(tie) {
  return String(tie?.name ?? '?').replace(/^the /i, '').slice(0, 1).toUpperCase();
}

/** Builds a tie's round portrait: the image when the tie has a safe portrait URL, otherwise the initial letter. */
export function tieDisc(tie, className = 'a') {
  const src = tie?.portrait;
  const style = typeof src === 'string' && /^[^"'()\\\s]+$/.test(src) && (src.includes('/') || src.startsWith('data:image')) ? { 'background-image': `url("${src}")` } : null;
  return h('span', { class: className, style, dataset: { portrait: src ?? null } }, style ? null : tieInitial(tie));
}
