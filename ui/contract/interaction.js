// Defines the view-model shape of the Scene tab (the open interaction as `interaction.view` reports it) and of the generic choice view.

import { SHAPE_TYPES as T } from './shapes.js';

export const SCENE_STATES = Object.freeze(['open', 'staged', 'sent', 'invalidated']);

export const SCENE_SHAPE = {
  id: T.STRING,
  kindId: T.STRING,
  title: T.STRING,
  state: { $enum: SCENE_STATES },
  steps: T.NUMBER,
  canSend: T.BOOLEAN,
  canDiscard: T.BOOLEAN,
  view: { $nullable: T.ANY },
  // A fight the reader's waiting message goes with (its Send and Discard answer the pause), and the waiting fight's offer (ui/select/hold.js): the fight renderer reads them.
  held: { $optional: T.BOOLEAN },
  hold: { $optional: T.ANY },
};

// What the generic renderer reads from `view` (both fields optional; anything else in `view` is the kind's own and is ignored). A choice names its actor: a step without one is refused.
export const GENERIC_VIEW_SHAPE = {
  lines: { $optional: [T.STRING] },
  choices: { $optional: [{ id: T.STRING, label: T.STRING, actor: T.STRING }] },
};
