// Builds the Scene tab fixtures: one made-up interaction (a choice at the ferry) in each state, as `interaction.view` reports it and as the Scene tab reads it.
import { selectScene } from '../select/interaction.js';
import { fightSceneAnswer } from './fight-scene.js';

export const SCENE_FIXTURE_STATES = Object.freeze(['open', 'staged', 'sent', 'invalidated']);

const LINES = [
  'The ferryman holds out a hand for the fare and says the river is high tonight.',
  'Behind you the lantern on the dock gutters; the road back to the inn is dark.',
];
const CHOICES = [
  { id: 'pay', label: 'Pay the two coppers and board', actor: 'astra' },
  { id: 'haggle', label: 'Haggle: the river is not that high', actor: 'astra' },
  { id: 'wait', label: 'Wait for the morning boat', actor: 'astra' },
];

/** The `interaction.view` answer for `state` (open | staged | sent | invalidated); `{ long: true }` adds a long text and eight choices; `{ fight: 'choose' }` is the open fight in that board moment instead (see fight-scene.js). */
export function sceneAnswer(state = 'open', { long = false, fight = null } = {}) {
  if (fight) return fightSceneAnswer(fight, { scene: state });
  const staged = state !== 'open';
  const choices = long ? Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, label: `${CHOICES[i % 3].label} (${i + 1}) and then keep going until the label has to wrap onto a second line`, actor: 'astra' })) : CHOICES;
  const lines = long ? [...LINES, ...LINES, ...LINES] : LINES;
  return {
    id: 'sid-9:0:probe/ferry',
    kindId: 'probe/ferry',
    title: 'The ferry crossing',
    state: SCENE_FIXTURE_STATES.includes(state) ? state : 'open',
    steps: staged ? [{ inputs: [{ actor: 'astra', choice: 'pay' }] }] : [],
    canSend: state === 'staged',
    canDiscard: true,
    view: { lines, choices },
  };
}

/** The Scene view-model (SCENE_SHAPE) of the same interaction. */
export const sceneFixture = (state, options) => selectScene(sceneAnswer(state, options));
