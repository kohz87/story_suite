// Composes the Fight tab from a fight view-model: header, then the offer, board (foes, party, actions, log) or end by state.
import { h } from '../../kit/dom.js';
import { foesCard } from './foes.js';
import { partyCard } from './party-strip.js';
import { actionsCard, afterCard } from './actions.js';
import { logCard } from './log.js';
import { endCard, offerCard } from './end.js';

const PILL = { end: vm => vm.end?.outcome ?? 'won', offer: () => 'open', after: vm => `exchange ${vm.exchange} done` };

function healOf(actor) {
  const item = actor?.groups?.Item?.find(a => a.target === 'ally');
  return Number(/heals (\d+)/.exec(item?.damage ?? '')?.[1]) || 0;
}

function joinNames(list) {
  return list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

function afterNote(vm) {
  const hurt = vm.log.at(-1)?.summary;
  return hurt ? `${hurt}.` : '';
}

/**
 * Builds the Fight tab from a `fight` view-model. `ctx` = { port, prefs, go(tab) }. Actions are sent as `rpg.board.*` commands.
 * Picking an action and its target is local until a target is tapped; a redraw from the engine resets it.
 */
export function fightTab(vm, ctx = {}) {
  if (!vm || !vm.foeGroups?.length) return null;
  const send = (type, payload = {}) => ctx.port?.command?.(type, payload);
  let sel = null; // { action, kind } while a target is being picked
  const root = h('div', { class: 'fight-tab', dataset: { tab: 'fight' } });
  const memberOf = id => vm.party.find(p => p.id === id);

  function stage(target) {
    send('rpg.board.stage', { actorId: vm.actor.id, action: sel.action, target });
    sel = null;
    draw();
  }

  function pick(action) {
    if (action.target === 'none') return send('rpg.board.stage', { actorId: vm.actor.id, action: action.id, target: null });
    sel = { action: action.id, label: action.label, kind: action.target === 'ally' ? 'ally' : action.target };
    draw();
  }

  function step() {
    const board = vm.state === 'choose' || vm.state === 'target' || vm.state === 'ally';
    if (board && sel) return sel.kind === 'ally' ? 'ally' : 'target';
    return board ? 'choose' : vm.state;
  }

  function banner(s) {
    if (s === 'ally') return h('div', { class: 'banner ally' }, `${sel.label}: tap who gets it.`);
    const text = sel.kind === 'group' ? `${sel.label}: one roll for each member of a group. Tap a group.` : `${sel.label}: tap a foe. Each shows your chance against it.`;
    return h('div', { class: 'banner' }, text);
  }

  function board(s) {
    const open = Boolean(ctx.prefs?.getFold?.('fight.party', false));
    const toggleParty = () => {
      const card = root.querySelector('.party-card');
      const next = card?.dataset.open !== 'true';
      if (card) card.dataset.open = String(next);
      ctx.prefs?.setFold?.('fight.party', next);
    };
    const foes = foesCard(vm.foeGroups, { pick: s === 'target' ? sel.kind : null, onPick: stage });
    const party = partyCard(vm.party, { step: s, exchange: vm.exchange, actorId: vm.actor?.id, heal: healOf(vm.actor), open, onToggle: toggleParty, onAlly: id => stage({ kind: 'ally', id }) });
    const panel = s === 'after'
      ? afterCard({ exchange: vm.exchange, note: afterNote(vm), onNext: () => send('rpg.board.next'), onAuto: () => send('rpg.board.auto') })
      : actionsCard(vm.actor, vm.actor && memberOf(vm.actor.id), {
        sel: sel?.action, party: vm.party, onPick: pick,
        onStance: on => send('rpg.board.stance', { actorId: vm.actor.id, on }),
        onBack: () => { sel = null; draw(); }, onAuto: () => send('rpg.board.auto'), onDiscard: () => send('rpg.board.discard'),
      });
    const left = s === 'ally' ? [sel && banner(s), party, foes] : [s === 'target' ? banner(s) : null, foes, party];
    return h('div', { class: ['fgrid', s === 'choose' ? 'chz' : null] },
      h('div', { class: 'fcol fa' }, left), h('div', { class: 'fcol fb' }, panel), h('div', { class: 'fcol fc' }, logCard({ ...vm, state: s }, ctx)));
  }

  function draw() {
    const s = step();
    root.dataset.step = s;
    root.dataset.fold = s === 'choose' ? '1' : '0';
    const all = vm.foeGroups.flatMap(g => g.members);
    const header = h('section', { class: 'glass fhead', dataset: { card: 'fight-head' } },
      h('span', { class: 't' }, h('b', null, vm.title), h('small', null, joinNames(vm.foeGroups.map(g => g.name)))),
      h('span', { class: ['fpill', vm.end?.outcome === 'won' ? 'won' : null] }, (PILL[vm.state] ?? (v => `exchange ${v.exchange}`))(vm)));
    let body;
    if (s === 'offer') {
      body = [offerCard({ foes: all.length, onBoard: () => send('rpg.board.start', { mode: 'board' }), onAuto: () => send('rpg.board.auto'), onStory: () => ctx.go?.('chat') }),
        foesCard(vm.foeGroups), partyCard(vm.party, { step: 'offer', exchange: vm.exchange })];
    } else if (s === 'end') {
      const down = { down: all.filter(m => m.hp <= 0).length, total: all.length };
      body = [endCard(vm.end, { party: vm.party, down, onBack: () => { send('rpg.board.finish'); ctx.go?.('chat'); }, onDiscard: () => send('rpg.board.discard') }), logCard(vm, ctx)];
    } else {
      body = [board(s)];
    }
    root.replaceChildren(header, ...body.filter(Boolean));
  }

  draw();
  return root;
}
