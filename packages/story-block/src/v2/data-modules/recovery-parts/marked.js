// Whether a Character definition carries the recovery mark, and whether it still has the old rest buttons.
const BAR_FIELDS = ['health', 'stamina', 'mana'];

/** Whether a Character definition carries the mark (all three bars `scale: 2`). */
export const isMarkedCharacter = definition => definition?.role === 'character'
    && BAR_FIELDS.every(bar => definition.state?.[bar]?.scale === 2);

/** The two reader buttons an earlier marked Character was pinned with: never drawn now; their recorded lines still replay (part/act.js). */
export const hasRestButtons = definition => isMarkedCharacter(definition) && ['button-rest', 'button-full-rest'].every(kind => definition.kinds?.[kind]?.ui);
