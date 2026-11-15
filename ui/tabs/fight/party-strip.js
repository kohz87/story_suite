// Builds the Party card for a fight: each member's health, Stamina and pick, folded to one row on a phone while choosing.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

function avatar(member) {
  const initial = String(member.name || '?').trim().charAt(0).toUpperCase();
  return h('span', { class: 'a', dataset: { portrait: member.portrait || null }, 'aria-hidden': 'true' }, initial);
}

function pct(value, max) {
  return `${Math.round((Math.max(0, value) / (max || 1)) * 100)}%`;
}

function foldCell(member, actorId, onToggle) {
  const choosing = member.id === actorId;
  const chosen = Boolean(member.chosen);
  return h(
    'button',
    {
      type: 'button',
      class: ['pm', choosing ? 'act' : null],
      dataset: { pexp: member.id },
      'aria-label': `${member.name}: health ${member.hp} of ${member.hpMax}${chosen ? ', has chosen' : choosing ? ', choosing' : ''}. Show the party`,
      onClick: onToggle,
    },
    avatar(member),
    chosen ? h('span', { class: 'ok' }, '✓') : null,
    h('span', { class: 'pmi' }, h('b', null, member.name), h('span', { class: 'hp' }, `${member.hp}/${member.hpMax}`)),
  );
}

function fullCell(member, { step, actorId, heal, onAlly }) {
  const choosing = member.id === actorId && (step === 'choose' || step === 'target' || step === 'ally');
  const picks = step === 'ally' && member.hp < member.hpMax;
  const note = member.chosen || (choosing ? 'choosing…' : '');
  const inner = [
    avatar(member),
    h('span', { class: 'pmi' },
      h('b', null, member.name),
      h('span', { class: 'hb' }, h('b', { style: { width: pct(member.hp, member.hpMax) } })),
      h('span', { class: 'hp' }, `Health ${member.hp}/${member.hpMax}`,
        picks && heal ? h('span', { class: 'heal' }, ` → ${Math.min(member.hpMax, member.hp + heal)}`) : null),
      h('span', { class: 'hp' }, `Stamina ${member.sp}/${member.spMax}`)),
    h('span', { class: ['ch2', step === 'after' ? 'done' : null] }, note),
  ];
  if (step === 'ally') {
    return h('button', { type: 'button', class: 'pm tgt', dataset: { ally: member.id }, onClick: () => onAlly?.(member.id) }, inner);
  }
  return h('div', { class: ['pm', choosing ? 'act' : null], dataset: { member: member.id } }, inner);
}

function countText(party, step, exchange) {
  if (step === 'offer') return `${party.length} here`;
  if (step === 'after') return `exchange ${exchange} done`;
  return `exchange ${exchange} · ${party.filter(p => p.chosen).length} of ${party.length} chosen`;
}

/**
 * Builds the Party card. Options: `step`, `exchange`, `actorId`, `heal` (points a healing item gives), `open` (the phone fold
 * is open), `onToggle()` (fold or open), `onAlly(id)` (an ally was tapped while using an item).
 */
export function partyCard(party = [], { step = 'choose', exchange = 1, actorId = null, heal = 0, open = false, onToggle, onAlly } = {}) {
  if (!Array.isArray(party) || party.length === 0) return null;
  const folding = step === 'choose';
  return h(
    'section',
    { class: 'card glass cpt party-card', 'aria-label': 'Party', dataset: { card: 'party', open: String(Boolean(open)), step } },
    folding ? h('div', { class: 'prt p1 fold-view' }, party.map(m => foldCell(m, actorId, onToggle))) : null,
    h(
      'div',
      { class: 'full-view' },
      h('div', { class: 'ch' }, h('h3', null, 'Party'), h('span', { class: 'cnt' }, countText(party, step, exchange)),
        folding ? button({ label: 'Fold', className: 'pfold-btn', onClick: onToggle }) : null),
      h('div', { class: 'prt' }, party.map(m => fullCell(m, { step, actorId, heal, onAlly }))),
    ),
  );
}
