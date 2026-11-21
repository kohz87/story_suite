// Builds the Help page: the FAQ as questions you open, a search box over them, and buttons that jump to the Settings pages an answer names.
import { h } from '../kit/dom.js';
import { FAQ_MARKDOWN } from './help-faq-data.js';
import { parseFaq, inlinePieces, entryText } from './help-parse.js';

function inline(piece, ctx) {
  if (piece.bold !== undefined) return h('b', piece.bold);
  if (piece.code !== undefined) return h('code', piece.code);
  if (piece.page === undefined) return piece.text;
  // a page this host does not have is plain text, not a dead button
  if (ctx.has && !ctx.has(piece.page)) return piece.label;
  return h('button', { type: 'button', class: 'hlink', onClick: () => ctx.go?.(piece.page) }, piece.label);
}

/**
 * Creates the Help page body builder over the settings overlay's `ctx` ({ go(id), has(id), repaint() }). `markdown` is the FAQ text (the bundled FAQ by default).
 * Returns `() => nodes`: a search box and the list. Typing filters in place (no repaint, so the box keeps focus); a search opens every answer it finds, otherwise a tap opens one.
 */
export function createHelpPage(ctx = {}, markdown = FAQ_MARKDOWN) {
  const entries = parseFaq(markdown).map(entry => ({ ...entry, hay: entryText(entry) }));
  const opened = new Set();
  let query = '';

  return function build() {
    const list = h('div', { class: 'helplist' });
    const search = h('input', { type: 'search', class: 'psrch hsrch', placeholder: 'Search the questions…', 'aria-label': 'Search the questions', value: query });
    const draw = () => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = entries.filter(e => words.every(w => e.hay.includes(w)));
      list.replaceChildren(...(hits.length === 0
        ? [h('p', { class: 'fine hnone' }, 'No question matches that. Try fewer or other words.')]
        : hits.map(entry => {
          const open = words.length > 0 || opened.has(entry.title);
          return h('div', { class: 'hq', dataset: { open: String(open) } },
            h('button', { type: 'button', class: 'hq-t', 'aria-expanded': String(open), onClick: () => { if (opened.has(entry.title)) opened.delete(entry.title); else opened.add(entry.title); draw(); } }, entry.title),
            open ? h('div', { class: 'hq-a' }, entry.paragraphs.map(p => h('p', inlinePieces(p).map(piece => inline(piece, ctx))))) : null);
        })));
    };
    search.addEventListener('input', () => { query = search.value; draw(); });
    draw();
    return [h('div', { class: 'hbar' }, search), list];
  };
}
