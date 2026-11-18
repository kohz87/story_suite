// Makes every card on a Settings page foldable: the card's title (`.sgrp > .gt`) becomes a button with a chevron and aria-expanded, and a
// folded card shows only its title. Which cards are folded is kept per device (the prefs' folds); a card starts open.
import { h } from '../kit/dom.js';

const KEY = 'settings.fold';
// A card's lasting name: its title without a count after " · " ("Trackers in this chat · 2 of 8" is "Trackers in this chat").
const nameOf = text => String(text ?? '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');

/** The fold key of a card titled `title` on section `section` (stored true while it is folded). */
export const foldKey = (section, title) => `${KEY}.${section}.${nameOf(title)}`;

/** A fold store over `prefs` ({ getFold(key, fallback), setFold(key, on) }); without prefs, folds last while the overlay is open. */
export function foldStore(prefs) {
  if (typeof prefs?.getFold === 'function' && typeof prefs?.setFold === 'function') return { get: key => prefs.getFold(key, false) === true, set: (key, on) => prefs.setFold(key, on) };
  const mem = new Map();
  return { get: key => mem.get(key) === true, set: (key, on) => mem.set(key, on) };
}

/** Turns the card titles under `root` (a section page) into fold buttons, folding the cards `store` says are folded. */
export function foldGroups(root, section, store) {
  for (const card of root.querySelectorAll('.sgrp')) {
    const title = [...card.children].find(c => c.classList?.contains('gt'));
    if (!title || title.tagName === 'BUTTON') continue;
    const key = foldKey(section, title.textContent);
    // The chevron is drawn by the stylesheet, so the title's text stays the card's name.
    const btn = h('button', { type: 'button', class: 'gt', 'aria-expanded': 'true' }, title.textContent);
    const set = folded => {
      btn.setAttribute('aria-expanded', String(!folded));
      if (folded) card.classList.add('folded'); else card.classList.remove('folded');
    };
    btn.addEventListener('click', () => { const folded = btn.getAttribute('aria-expanded') === 'true'; set(folded); store.set(key, folded); });
    card.insertBefore(btn, title);
    title.remove();
    set(store.get(key));
  }
}
