// The Fight tab while the reader's message waits for a fight (mock v7's offer): the head, the offer card, then the foes and the party.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { foesCard } from '../fight/foes.js';
import { partyCard } from '../fight/party-strip.js';

const joinNames = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
// (mock v7 writes the count as a word: "Four foes block the bridge."; the place's own verb is the story's, so the line says they stand in your way)
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const foeLine = n => `${WORDS[n] ?? n} ${n === 1 ? 'foe stands' : 'foes stand'} in your way. Choose each exchange on the board, let the code fight it out, or keep telling the story.`;

/**
 * Builds the offer for the waiting fight `vm` (ui/select/hold.js: `vm.hold`, `vm.view` with foe groups and party). `api.choose(choice)` answers the pause
 * ('board', 'auto' or 'plain': Keep telling the story sends the message without a fight, shown only when the pause offers it); `api.note` shows a refusal.
 * The card is mock v7's offer (its words and three buttons); a refusal the pause kept (`hold.error`) shows under the buttons.
 */
export function fightOffer(vm, api = {}) {
  const { hold, view } = vm;
  const root = h('div', { class: 'fight-tab scene-fight', dataset: { renderer: 'fight', state: vm.state, step: 'offer', hold: hold.working ? 'working' : 'ready' } });
  const names = view.foeGroups.map(g => g.name);
  const head = h('section', { class: 'glass fhead', dataset: { card: 'fight-head' } },
    h('span', { class: 't' }, h('b', null, view.title), view.subtitle || names.length ? h('small', null, view.subtitle ?? joinNames(names)) : null),
    h('span', { class: 'fpill' }, 'open'));
  const all = hold.count || view.foeGroups.reduce((n, g) => n + g.members.length, 0);   // every foe, a group bigger than the shown members too
  const choose = choice => () => api.choose?.(choice);
  const offer = h('section', { class: 'card glass offer', dataset: { card: 'offer' } },
    h('p', { class: 'otext' }, hold.working ? hold.line : foeLine(all)),
    hold.working ? null : h('div', { class: 'brow3' },
      button({ label: 'Fight on the board', tone: 'primary', dataset: { offer: 'board' }, onClick: choose('board') }),
      button({ label: 'Auto-fight', dataset: { offer: 'auto' }, onClick: choose('auto') }),
      hold.plain ? button({ label: 'Keep telling the story', dataset: { offer: 'story' }, onClick: choose('plain') }) : null),
    hold.error ? h('p', { class: 'fine scene-note', role: 'status' }, hold.error) : null);
  root.replaceChildren(...[head, offer, foesCard(view.foeGroups), partyCard(view.party, { step: 'offer', exchange: view.exchange }), api.note].filter(Boolean));
  return root;
}
