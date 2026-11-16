// Names: the story-check kind, its setting and its grammar line.

/** The narrator's kind word for a story check (`? roll …`): Story Director owns `check`, so this one is Story Block's own. */
export const ROLL_KIND = 'roll';
/** The setting (Fight & checks): story checks outside a fight, on unless set to false. Off: no dice and no grammar line from then on; results already recorded stay. Independent of Rolls (which is for fights): the dice and the grammar line follow this switch alone. */
export const CHECKS_SETTING = 'rpgChecks';
export const checksOn = values => values?.[CHECKS_SETTING] !== false;
/** The static grammar line of the `? roll` kind: constant text, shown while the RPG and Story checks are on, whatever the party or Rolls say (the dice follow the same switch). */
export const CHECK_GRAMMAR = '? roll Who | skill or stat | easy, normal, hard or very hard | die (Who rolls: {{user}} or a party member, by name, never the action; an attempt that can fail, with one of this reply\'s dice, in order; at most 3; e.g. ? roll {{user}} | Obscure | normal | 14)';
