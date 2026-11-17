// Story Director v2, part **keypeople**: the kinds' grammar line and the tail header.

export const TAIL_HEADER = '[Key people] Away from the scene:';

/** The kinds' one line for the change-line instruction (SPEC §4.4). */
export const GRAMMAR = Object.freeze({
    away: '+ away Name — what they are doing | back: date (~ away Name to change it; ! away Name — where they got to; - away Name when they are back)',
});

