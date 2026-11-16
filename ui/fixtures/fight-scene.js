// Builds the fight as the Scene tab gets it: the `interaction.view` answer of the open fight, its view a FIGHT_SHAPE from the shared fight fixture.
import { fightFixture } from './fight.js';

// The scene state a board moment is in: choosing is open, a resolved exchange is staged (Send is on offer).
const STAGED = new Set(['after', 'end']);
// The kind reports only offer, choose, after and end; picking a target is local to the renderer.
const VIEW_STATE = { target: 'choose', ally: 'choose' };

/** The `interaction.view` answer for the fight in board moment `fight` (offer | choose | target | ally | after | end), in scene state `scene` (default: by the moment). */
export function fightSceneAnswer(fight = 'choose', { scene = null, wide = false } = {}) {
  const view = { ...fightFixture(fight, { wide }) };
  view.state = VIEW_STATE[fight] ?? fight;
  const staged = STAGED.has(fight);
  const state = scene ?? (staged ? 'staged' : 'open');
  return {
    id: 'sid-9:0:story-block/fight',
    kindId: 'story-block/fight',
    title: view.title,
    state,
    steps: Array.from({ length: staged ? view.log.length : Math.max(0, view.exchange - 1) }, () => ({ inputs: [] })),
    canSend: state === 'staged',
    canDiscard: state !== 'sent',
    view,
  };
}
