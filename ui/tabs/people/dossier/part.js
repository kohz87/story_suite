// Builds an opened dossier part: its header (‹ Dossier, ‹ title "name · i of n" ›) and its body. Beside the cards on a desktop window; its own page below 1,080 px (ui/css/dossier.css).
import { h } from '../../../kit/dom.js';
import { nowPage, moodPage } from './now-page.js';
import { tiesPage, pastPage, secretsPage } from './past-secrets.js';
import { withPage } from './feelings.js';
import { profilePage } from './profile.js';
import { deathPage } from './death.js';

const BODIES = { death: deathPage, with: withPage, mood: moodPage, now: nowPage, ties: tiesPage, past: pastPage, secrets: secretsPage, profile: profilePage };

/**
 * Builds the part `current` of dossier `d` among `pages` [{ id, title }]. opts = { ctx (passed to the body), onBack(), onGo(id) }.
 * ‹ and › wrap round the parts; ‹ Dossier (shown only where the part is a page of its own) closes it.
 */
export function dossierPart(d, pages, current, { ctx = {}, onBack, onGo } = {}) {
  const i = pages.findIndex(p => p.id === current);
  const page = pages[i];
  const step = by => pages[(i + by + pages.length) % pages.length];
  const arrow = (by, symbol, label) => (pages.length > 1 ? h('button', {
    type: 'button', class: ['pb', by < 0 ? 'prev' : 'next'], 'aria-label': label, dataset: { act: label.toLowerCase(), go: step(by).id }, onClick: () => onGo?.(step(by).id),
  }, symbol) : null);
  return h('section', { class: 'dpane', dataset: { page: page.id }, 'aria-label': page.title },
    h('div', { class: 'dh' },
      h('button', { type: 'button', class: 'bk2', dataset: { act: 'back' }, onClick: () => onBack?.() }, '‹ Dossier'),
      arrow(-1, '‹', 'Previous'),
      h('span', { class: 'ptl' }, h('b', null, page.title), h('small', null, `${d.name} · ${i + 1} of ${pages.length}`)),
      arrow(1, '›', 'Next')),
    h('div', { class: 'db' }, [BODIES[page.id](d, ctx)].flat().filter(Boolean)));
}
