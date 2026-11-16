// The scene host: the Scene tab's frame (header, the kind's renderer, Send and Discard) for the interaction that is open.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';
import { genericScene } from './generic.js';

const PILL = { open: 'open', staged: 'staged', sent: 'sent', invalidated: 'taken back' };

/** Renderers by kind id: `(vm, api) → node`. A kind without one gets the generic renderer. The fight renderer registers here. */
export const RENDERERS = {};

/** Builds the Scene tab from a `scene` view-model. `ctx` = { port, renderers }. Every action is an `interaction.*` command; a refusal shows its message. */
export function sceneTab(vm, ctx = {}) {
  if (!vm?.id) return null;
  const draw = (ctx.renderers ?? RENDERERS)[vm.kindId] ?? genericScene;
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
  const api = { stage: step => run('stage', { step }), auto: n => run('auto', { n }) };
  const head = h('section', { class: 'glass fhead scene-head', dataset: { card: 'scene-head' } },
    h('span', { class: 't' }, h('b', null, vm.title)),
    h('span', { class: 'fpill scene-pill' }, PILL[vm.state] ?? vm.state));
  const foot = vm.canSend || vm.canDiscard
    ? h('div', { class: 'brow3 scene-actions', dataset: { card: 'scene-actions' } },
      vm.canSend ? button({ label: 'Send with this', tone: 'primary', dataset: { act: 'send' }, onClick: () => run('send', {}) }) : null,
      vm.canDiscard ? button({ label: 'Discard', dataset: { act: 'discard' }, onClick: () => run('discard', {}) }) : null)
    : null;
  root.replaceChildren(head, draw(vm, api), note, foot);
  return root;
}
