// Turns the `interaction.view` answer (the open interaction) into the activity view-model (SCENE_SHAPE); null when none is open.

import { SCENE_STATES } from '../contract/interaction.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '');

/** Activity view-model from `current` (the `interaction.view` answer: { id, kindId, title, state, steps, canSend, canDiscard, view }). */
export function selectScene(current) {
  if (!isRecord(current) || !text(current.id) || !text(current.kindId)) return null;
  return {
    id: current.id,
    kindId: current.kindId,
    title: text(current.title) || 'Activity',
    state: SCENE_STATES.includes(current.state) ? current.state : 'open',
    steps: Array.isArray(current.steps) ? current.steps.length : 0,
    canSend: current.canSend === true,
    canDiscard: current.canDiscard !== false,
    view: current.view === undefined ? null : current.view,
  };
}
