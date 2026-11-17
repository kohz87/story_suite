// Builds the fight as the Scene tab gets it: the `interaction.view` answer of the open fight, its view a FIGHT_SHAPE from the shared fight fixture.
import { fightFixture } from './fight.js';
import { V1_VIEWS } from './fight-v1.js';
import { selectScene } from '../select/interaction.js';

// The scene state a board moment is in: choosing is open, a resolved exchange is staged (Send is on offer).
const STAGED = new Set(['after', 'end']);
// The kind reports only offer, choose, after and end; picking a target is local to the renderer.
const VIEW_STATE = { target: 'choose', ally: 'choose' };

/** The `interaction.view` answer for the fight in board moment `fight` (offer | choose | target | ally | after | end), in scene state `scene` (default: by the moment). */
export function fightSceneAnswer(fight = 'choose', { scene = null, wide = false } = {}) {
  // `real` / `realafter`: a captured v1 fight (fight-v1.js), not the made-up bridge fight.
  const real = fight === 'real' ? V1_VIEWS.choose : fight === 'realafter' ? V1_VIEWS.after : null;
  const view = real ? structuredClone(real) : { ...fightFixture(fight, { wide }) };
  if (!real) view.state = VIEW_STATE[fight] ?? fight;
  const staged = real ? real.state === 'after' : STAGED.has(fight);
  const state = scene ?? (staged ? 'staged' : 'open');
  return {
    id: 'sid-9:0:story-block/fight',
    kindId: 'story-block/fight',
    title: view.title,
    state,
    steps: Array.from({ length: real ? (staged ? 1 : 0) : staged ? view.log.length : Math.max(0, view.exchange - 1) }, () => ({ inputs: [] })),
    canSend: state === 'staged',
    canDiscard: state !== 'sent',
    view,
  };
}

/** The Fight tab while the reader's message waits for the fight (ui/select/hold.js's shape): the bridge fight's offer moment with the pause's three answers. */
export function fightHoldScene() {
  const scene = selectScene(fightSceneAnswer('offer'));
  const count = scene.view.foeGroups.reduce((n, group) => n + group.members.length, 0);
  return { ...scene, steps: 0, canSend: false, canDiscard: false, hold: { working: false, count, plain: true, line: '', error: '' } };
}
