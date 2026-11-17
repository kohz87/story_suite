// Builds the offer card that starts a fight and the won, fled or lost card that ends it.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

const HEADLINE = { won: 'Won', fled: 'Fled', lost: 'Lost' };
const LINE = {
  won: 'The foes are beaten.',
  fled: 'You got away; the foes are still out there.',
  lost: 'The party fell. The story picks up from here.',
};

/** Builds the Offer card: fight on the board, auto-fight, or keep telling the story. */
export function offerCard({ foes = 0, onBoard, onAuto, onStory } = {}) {
  return h(
    'section',
    { class: 'card glass offer', dataset: { card: 'offer' } },
    h('p', { class: 'anote' }, `${foes} ${foes === 1 ? 'foe stands' : 'foes stand'} in your way. Choose each exchange on the board, let the code fight it out, or keep telling the story.`),
    h('div', { class: 'brow3' },
      button({ label: 'Fight on the board', tone: 'primary', dataset: { offer: 'board' }, onClick: onBoard }),
      button({ label: 'Auto-fight', dataset: { offer: 'auto' }, onClick: onAuto }),
      button({ label: 'Keep telling the story', dataset: { offer: 'story' }, onClick: onStory })),
  );
}

function memberRow(m, who) {
  const name = who?.name ?? m.id;
  const stats = who ? ` · Stamina ${who.sp}/${who.spMax} · Mana ${who.mp}/${who.mpMax}` : '';
  return h('div', { class: 'endr', dataset: { member: m.id } },
    h('span', { class: 'a', dataset: { portrait: who?.portrait || m.id }, 'aria-hidden': 'true' }, String(name).charAt(0).toUpperCase()),
    h('b', null, name),
    h('span', null, `Health ${m.hp}/${m.hpMax}${stats}`, m.xp === null || m.xp === undefined ? null : h('b', { class: 'xp' }, ` · +${m.xp} XP`),
      m.practice.length ? h('span', { class: 'prc' }, m.practice.map(p => h('i', null, `${p.skill} +${p.gain}`))) : null));
}

/** Builds the end card from `end` ({ outcome, xpEach, exchanges, members: [{ id, hp, hpMax, xp, practice }] }); `ctx` = { party (the fight's party strip, for names, Stamina and Mana), down: { down, total }, onBack, onDiscard }. */
export function endCard(end, ctx = {}) {
  if (!end) return null;
  const { party = [], down = null, onBack, onDiscard } = ctx;
  return h(
    'section',
    { class: ['card glass endb', `is-${end.outcome}`], dataset: { card: 'end', outcome: end.outcome } },
    h('span', { class: 'big2' }, HEADLINE[end.outcome] ?? end.outcome),
    h('span', { class: 'anote' }, LINE[end.outcome] ?? ''),
    h('div', { class: 'xpr' },
      end.xpEach === null ? null : h('div', null, h('b', null, `+${end.xpEach} XP`), 'each'),
      h('div', null, h('b', null, String(end.exchanges)), end.exchanges === 1 ? 'exchange' : 'exchanges'),
      down ? h('div', null, h('b', null, `${down.down} of ${down.total}`), 'foes down') : null),
    h('div', { class: 'endp' }, end.members.map(m => memberRow(m, party.find(p => p.id === m.id)))),
    h('p', { class: 'fine' }, 'Practice: +1 for each use of a skill, +1 for each exchange a stance was up.'),
    h('p', { class: 'fine' }, 'Goes to the story with your next message. The story writes what you find on them.'),
    h('div', { class: 'fbtns' },
      onBack ? button({ label: 'Back to the story ›', tone: 'primary', dataset: { finish: '1' }, onClick: onBack }) : null,
      h('span', { style: 'flex:1' }),
      onDiscard ? button({ label: 'Discard the fight', tone: 'danger', dataset: { discard: '1' }, onClick: onDiscard }) : null),
  );
}
