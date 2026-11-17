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

/** The fight kind's id: its interaction is shown on the Fight tab, any other on the activity tab. */
export const FIGHT_KIND = 'story-block/fight';

/** The activity view-model when the open interaction is a fight, else null. */
export function selectFightScene(current) {
  const view = selectScene(current);
  return view?.kindId === FIGHT_KIND ? view : null;
}

/** What the Now card's "fight open" row reads: the fight's board state while it is being played, 'end' once it is over or sent (nothing is left to choose). */
export const fightNeeds = fight => ({ state: ['open', 'staged'].includes(fight.state) ? fight.view?.state ?? 'choose' : 'end' });
