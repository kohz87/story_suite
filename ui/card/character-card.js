// Builds the full character card shown on top of every tab, with a Story-only variant when RPG is off.
import { h } from '../kit/dom.js';
import { glyph } from '../kit/glyphs.js';
import { chip } from '../kit/controls.js';
import { bars, expBar } from '../kit/bars.js';
import { cardRow } from './card-row.js';

function portrait(you) {
  const initial = String(you.name || '?').trim().charAt(0).toUpperCase();
  return h('div', { class: 'por', dataset: { portrait: you.portrait || null }, 'aria-hidden': 'true' }, initial);
}

function chipRow(card, onPace) {
  const { you, chips = {} } = card;
  const out = [];
  if (card.rpg) {
    if (you.levelText) out.push(h('span', { class: 'lvl2' }, you.levelText));
    if (Number.isFinite(chips.soakPct)) {
      out.push(chip({ label: `${chips.soakPct}%`, icon: 'armor', title: 'Soak', className: 'soak' }));
    }
    if (chips.party) {
      out.push(chip({ label: `${chips.party.n}/${chips.party.max}`, icon: 'party', title: 'Party', className: 'party' }));
    }
  }
  if (chips.pace) {
    const p = chips.pace;
    out.push(chip({
      label: `${p.kmDay} km/day`,
      icon: 'road',
      title: p.why || null,
      tone: p.slowed ? 'slow' : null,
      className: 'pace',
      onClick: onPace,
    }));
  }
  return out;
}

function statusChips(statuses) {
  if (!statuses || !statuses.length) return null;
  return h(
    'div',
    { class: 'fx2' },
    statuses.map(s => h(
      'span',
      { class: `f ${s.tone}`, dataset: { status: s.id } },
      h('span', { class: 'ic' }, glyph(s.tone === 'buff' ? 'stance' : 'warn')),
      h('span', { class: 'tx' }, h('b', s.label), s.note ? h('small', s.note) : null),
    )),
  );
}

/** Creates the card section from a card view-model; handlers: onBack, onScene, onSettings, onPace. */
export function characterCard(card, handlers = {}) {
  const you = card.you || { name: '' };
  const hasStats = Boolean(card.rpg);
  const chips = chipRow(card, handlers.onPace);
  return h(
    'section',
    { class: `card glass hero hero-new${hasStats ? '' : ' story-only'}`, dataset: { card: 'character' } },
    cardRow(card.scene, handlers),
    h(
      'div',
      { class: 'nrow' },
      portrait(you),
      h('div', { class: 'nmw' }, h('div', { class: 'nm' }, you.name), chips.length ? h('div', { class: 'chips' }, chips) : null),
    ),
    hasStats ? bars(card.bars) : null,
    hasStats ? expBar(card.exp) : null,
    statusChips(card.statuses),
  );
}
