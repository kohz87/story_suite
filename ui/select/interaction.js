// Turns the `interaction.view` answer (the open interaction) into the Scene view-model (SCENE_SHAPE); null when none is open.

import { SCENE_STATES } from '../contract/interaction.js';

// The fight board keeps its own Fight tab until the fight renderer is built on the scene host.
const OWN_TAB = new Set(['story-block/fight']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '');

/** Scene view-model from `current` (the `interaction.view` answer: { id, kindId, title, state, steps, canSend, canDiscard, view }). */
export function selectScene(current) {
  if (!isRecord(current) || !text(current.id) || !text(current.kindId) || OWN_TAB.has(current.kindId)) return null;
  return {
    id: current.id,
    kindId: current.kindId,
    title: text(current.title) || text(current.kindId.split('/').at(-1)) || 'Scene',
    state: SCENE_STATES.includes(current.state) ? current.state : 'open',
    steps: Array.isArray(current.steps) ? current.steps.length : 0,
    canSend: current.canSend === true,
    canDiscard: current.canDiscard !== false,
    view: current.view === undefined ? null : current.view,
  };
}
