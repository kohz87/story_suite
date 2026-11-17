// The activity host: the frame (header, the kind's renderer, Send and Discard) of the tab named after the interaction that is open.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { genericScene } from './generic.js';
import { fightScene } from './fight.js';

const PILL = { open: 'open', staged: 'staged', sent: 'sent', invalidated: 'taken back' };

/** Renderers by kind id: `(vm, api) → node`. A module registers its own renderer here (see docs/dev/interaction.md); a kind without one gets the generic renderer and a "basic view" note. A renderer with `ownFrame` draws its own header, note and Send / Discard (api.note, api.send, api.discard). */
export const RENDERERS = { 'story-block/fight': fightScene };

/** Builds the activity tab from the open interaction's view-model. `ctx` = { port, renderers }. Every action is an `interaction.*` command; a refusal shows its message. */
export function sceneTab(vm, ctx = {}) {
  if (!vm?.id) return null;
  const own = (ctx.renderers ?? RENDERERS)[vm.kindId];
  const draw = own ?? genericScene;
  let busy = false;
  const note = h('p', { class: 'fine scene-note', role: 'status', hidden: true });
  const root = h('div', { class: 'scene-tab', dataset: { tab: 'scene', kind: vm.kindId, state: vm.state } });
  const run = async (verb, payload) => {
    if (busy) return null;
    busy = true;
    root.dataset.busy = '1';
    let answer = null;
    try { answer = await ctx.port?.command?.(`interaction.${verb}`, { id: vm.id, ...payload }); } catch { answer = null; }
    busy = false;
    delete root.dataset.busy;
    const failed = !answer || answer.ok === false;
    note.hidden = !failed;
    note.textContent = failed ? String(answer?.message || 'That could not be done.') : '';
    return answer;
  };
  // A fight the reader's waiting message goes with (`vm.held`) is sent and discarded through the pause (`interaction.choose`): Send writes the message's reply, Discard puts the pause back.
  // A send that went out (with the fight or without one) closes the view, so the reply is seen being written.
  const choose = async choice => { const answer = await run('choose', { choice }); if (answer?.ok && (choice === 'send' || choice === 'plain')) ctx.go?.('chat'); return answer; };
  const api = { stage: step => run('stage', { step }), auto: n => run('auto', { n }), send: () => (vm.held ? choose('send') : run('send', {})), discard: () => (vm.held ? choose('discard') : run('discard', {})), choose, back: () => ctx.go?.('chat'), note, prefs: ctx.prefs };
  const head = h('section', { class: 'glass fhead scene-head', dataset: { card: 'scene-head' } },
    h('span', { class: 't' }, h('b', null, vm.title)),
    h('span', { class: 'fpill scene-pill' }, PILL[vm.state] ?? vm.state));
  const basic = own ? null : h('p', { class: 'fine scene-basic', dataset: { note: 'basic-view' } }, 'Basic view: this activity has no view of its own.');
  const foot = vm.canSend || vm.canDiscard
    ? h('div', { class: 'brow3 scene-actions', dataset: { card: 'scene-actions' } },
      vm.canSend ? button({ label: 'Send with this', tone: 'primary', dataset: { act: 'send' }, onClick: () => api.send() }) : null,
      vm.canDiscard ? button({ label: 'Discard', dataset: { act: 'discard' }, onClick: () => api.discard() }) : null)
    : null;
  root.replaceChildren(...(draw.ownFrame === true ? [draw(vm, api)] : [head, basic, draw(vm, api), note, foot].filter(Boolean)));
  return root;
}
