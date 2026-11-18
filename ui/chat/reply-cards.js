// Draws the modules' cards under the head reply (a companion who may join, the death notice, a block's own card) and runs their buttons through the port.
import { h } from '../kit/dom.js';

/**
 * Runs one card button on the port: `command` as the reader's own action (port.command, recorded with the reply), `open` as a window
 * (port.open, the action's payload is its starting draft). → the port's answer ({ ok, message? }).
 */
export async function runCardAction(port, action) {
  if (!port || !action) return { ok: false, message: 'That button cannot work here.' };
  try {
    if (action.command) return (await port.command(action.command, action.payload ?? {})) ?? { ok: false };
    if (action.open) return (await port.open(action.open, action.payload ?? {})) ?? { ok: false };
  } catch (error) {
    return { ok: false, message: String(error?.message || 'That did not work.') };
  }
  return { ok: false, message: 'That button cannot work here.' };
}

function cardNode({ key, card }, onAct) {
  const note = h('p', { class: 'sscd-why', role: 'status', hidden: true });
  const buttons = card.actions.map(action => h('button', {
    type: 'button',
    class: ['ssbtn', action.primary ? 'pri' : null],
    dataset: { act: action.id },
    onClick: async () => {
      for (const button of buttons) button.disabled = true;
      note.setAttribute('hidden', '');
      const answer = await onAct?.(action);
      for (const button of buttons) button.disabled = false;
      // (a done command redraws the chat on its own; a refusal stays here with its reason)
      if (answer && answer.ok === false) { note.textContent = String(answer.message || 'That did not work.'); note.removeAttribute('hidden'); }
    },
  }, action.label));
  return h(
    'section',
    { class: 'sscd', role: 'group', 'aria-label': card.title, dataset: { card: key, tone: card.tone } },
    h('b', { class: 'sscd-t' }, card.title),
    card.text ? h('p', { class: 'sscd-x' }, card.text) : null,
    card.rows.length ? h('ul', { class: 'sscd-rows' }, card.rows.map(row => h('li', row.text, row.tag ? h('span', { class: 'tag' }, row.tag) : null))) : null,
    buttons.length ? h('div', { class: 'sscd-acts' }, buttons) : null,
    note,
  );
}

/** The cards element for the chat view's `replyCards.list` ([{ key, card }]), or null when there is none; `onAct(action)` runs a button and answers the port's reply. */
export function replyCardStrip(list, onAct) {
  if (!Array.isArray(list) || !list.length) return null;
  return h('div', { class: 'sscards', dataset: { ssCards: '1' } }, list.map(item => cardNode(item, onAct)));
}
