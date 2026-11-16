// The fight renderer on the scene host: the Fight cards for the open fight, one pick per standing member, then one staged step.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { foesCard } from '../fight/foes.js';
import { partyCard } from '../fight/party-strip.js';
import { actionsCard, afterCard } from '../fight/actions.js';
import { logCard } from '../fight/log.js';
import { endCard } from '../fight/end.js';
import { heldFor, holdPick, undoPick, inputsOf } from './fight-picks.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const PILL = { end: v => v.end?.outcome ?? 'won', after: v => `exchange ${v.exchange} done` };
const SCENE_PILL = { sent: 'sent', invalidated: 'taken back' };
const NOTE = { sent: 'Sent. It plays out with the next reply.', invalidated: 'The earlier part was taken back. Restore that reply or discard this.' };
const joinNames = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const usable = view => isRecord(view) && Array.isArray(view.foeGroups) && view.foeGroups.length > 0 && Array.isArray(view.party);

/** Builds the fight body for the scene view-model `vm` (`vm.view` is a FIGHT_SHAPE). `api` = { stage(step), auto(n), send(), discard(), note }. The renderer draws its own header and Send / Discard. */
export function fightScene(vm, api = {}) {
  const view = usable(vm.view) ? vm.view : null;
  const live = vm.state === 'open' || vm.state === 'staged';
  const root = h('div', { class: 'fight-tab scene-fight', dataset: { renderer: 'fight', state: vm.state } });
  let sel = null; // { action, label, kind } while a target is being picked
  let moved = false; // the "Choose exchange N" press after a resolved exchange
  const actors = view && live && Array.isArray(view.actors) ? view.actors : [];
  const idOf = id => view.party.find(p => p.actorId === id)?.id ?? id;

  const targetName = target => {
    if (target.kind === 'ally') return view.party.find(p => p.id === target.id)?.name ?? target.id;
    const groups = view.foeGroups;
    return target.kind === 'group' ? groups.find(g => g.id === target.id)?.name ?? target.id : groups.flatMap(g => g.members).find(m => m.id === target.id)?.name ?? target.id;
  };

  const stageAll = async () => {
    const list = heldFor(vm, actors);
    if (list.length < actors.length) return draw();
    await api.stage?.({ inputs: inputsOf(list) });
    draw();
  };

  const stageAlone = async input => {
    await api.stage?.({ inputs: [structuredClone(input)] });
    draw();
  };

  function commit(action, target) {
    const list = heldFor(vm, actors), who = actors[list.length];
    if (!who) return;
    const args = { ...action.pick.args, ...(target?.arg ?? {}) }; // the view says how a tapped target is written (`arg`)
    const input = { actor: who.id, choice: action.pick.choice, args };
    if (action.pick.alone === true) { sel = null; return stageAlone(input); } // Flee is the whole exchange: staged at once, the other picks ignored
    holdPick(vm, { actor: who.id, input, text: `${action.label}${target ? ` → ${targetName(target)}` : ''}` });
    sel = null;
    if (list.length + 1 >= actors.length) stageAll(); else draw();
  }

  const pick = action => {
    if (action.target === 'none') return commit(action, null);
    sel = { action, label: action.label, kind: action.target };
    return draw();
  };

  const back = () => { if (sel) sel = null; else undoPick(vm); draw(); };

  const discard = vm.canDiscard ? () => api.discard?.() : null;
  let carried = false; // a card on screen carries the danger Discard (mock v7); otherwise the foot draws it

  function board(phase, list) {
    const asked = actors[list.length], member = asked ? view.party.find(p => p.actorId === asked.id) : null;
    const party = view.party.map(p => ({ ...p, chosen: list.find(e => e.actor === p.actorId)?.text ?? null }));
    const open = Boolean(api.prefs?.getFold?.('fight.party', false));
    const toggle = () => { const card = root.querySelector('.party-card'), next = card?.dataset.open !== 'true'; if (card) card.dataset.open = String(next); api.prefs?.setFold?.('fight.party', next); };
    const foes = foesCard(view.foeGroups, { pick: phase === 'target' ? sel.kind : null, onPick: target => commit(sel.action, target) });
    const strip = partyCard(party, { step: phase, exchange: view.exchange, actorId: member?.id, open, onToggle: toggle, onAlly: id => commit(sel.action, { kind: 'ally', id, arg: view.party.find(p => p.id === id)?.arg }) });
    let panel = null;
    if (phase === 'after') panel = afterCard({ exchange: view.exchange, note: view.log.at(-1)?.summary ? `${view.log.at(-1).summary}.` : '', onNext: actors.length ? () => { moved = true; draw(); } : null, onAuto: live ? () => api.auto?.(1) : null });
    else if (asked && member) panel = actionsCard({ id: member.id, groups: asked.groups }, member, { sel: sel?.action.id, party, onPick: pick, onBack: back, onAuto: () => api.auto?.(1), onDiscard: discard });
    else if (live && phase === 'choose' && actors.length) panel = h('section', { class: 'card glass actp', dataset: { card: 'ready' } }, h('p', { class: 'anote' }, 'Everyone has chosen.'), h('div', { class: 'fbtns' }, button({ label: 'Stage again', tone: 'primary', dataset: { stage: '1' }, onClick: stageAll }), button({ label: 'Back', dataset: { back: '1' }, onClick: back }), discard ? h('span', { style: { flex: '1' } }) : null, discard ? button({ label: 'Discard fight', tone: 'danger', dataset: { discard: '1' }, onClick: discard }) : null));
    carried = phase === 'after' ? actors.length > 0 : Boolean(panel && discard); // the live after card has "Choose exchange N+1" and no Discard (mock v7)
    const text = sel?.kind === 'ally' ? `${sel.label}: tap who gets it.` : sel?.kind === 'group' ? `${sel.label}: one roll for each member of a group. Tap a group.` : sel ? `${sel.label}: tap a foe. Each shows your chance against it.` : '';
    const banner = sel ? h('div', { class: ['banner', sel.kind === 'ally' ? 'ally' : null] }, text) : null;
    const left = phase === 'ally' ? [banner, strip, foes] : [banner, foes, strip];
    return h('div', { class: ['fgrid', phase === 'choose' ? 'chz' : null] }, h('div', { class: 'fcol fa' }, left), h('div', { class: 'fcol fb' }, panel), h('div', { class: 'fcol fc' }, logCard({ ...view, state: view.state === 'after' ? 'after' : phase }, api)));
  }

  function draw() {
    const list = view ? heldFor(vm, actors) : [];
    let phase = view?.state === 'end' || view?.state === 'after' ? view.state : 'choose';
    if (phase === 'after' && moved && actors.length) phase = 'choose';
    if (phase === 'choose' && sel) phase = sel.kind === 'ally' ? 'ally' : 'target';
    if (!actors.length && phase === 'choose') phase = view?.state === 'offer' ? 'offer' : phase;
    root.dataset.step = phase;
    root.dataset.fold = phase === 'choose' ? '1' : '0';
    const pill = SCENE_PILL[vm.state] ?? (view ? (PILL[view.state] ?? (v => `exchange ${v.exchange}`))(view) : vm.state);
    const head = h('section', { class: 'glass fhead', dataset: { card: 'fight-head' } },
      h('span', { class: 't' }, h('b', null, view?.title || vm.title), view ? h('small', null, view.subtitle ?? joinNames(view.foeGroups.map(g => g.name))) : null),
      h('span', { class: ['fpill', view?.end?.outcome === 'won' ? 'won' : null] }, pill));
    let body;
    carried = false;
    if (!view) body = h('p', { class: 'fine scene-empty' }, 'Nothing to show for this yet.');
    else if (phase === 'end') {
      const all = view.foeGroups.flatMap(g => g.members);
      carried = Boolean(discard);
      body = [endCard(view.end, { party: view.party, down: { down: all.filter(m => m.hp <= 0).length, total: all.length }, onDiscard: discard }), logCard(view, api)];
    } else body = board(phase === 'offer' ? 'offer' : phase, list);
    const footDiscard = vm.canDiscard && !carried;
    const foot = vm.canSend || footDiscard
      ? h('div', { class: 'brow3 scene-actions', dataset: { card: 'scene-actions' } },
        vm.canSend ? button({ label: 'Send with this', tone: 'primary', dataset: { act: 'send' }, onClick: () => api.send?.() }) : null,
        footDiscard ? button({ label: 'Discard fight', tone: 'danger', dataset: { discard: '1' }, onClick: discard }) : null) : null;
    root.replaceChildren(...[head, NOTE[vm.state] ? h('p', { class: 'fine scene-state' }, NOTE[vm.state]) : null, ...[].concat(body), api.note, foot].filter(Boolean)); // (a null child would be drawn as the text "null")
  }

  draw();
  return root;
}

/** The host draws no header or Send / Discard for this renderer: it draws its own. */
fightScene.ownFrame = true;
