// Story Director v2, part **keypeople**: the fixed prompt paragraph, the kinds' grammar lines and the tail header.

export const TAIL_HEADER = '[Key people] Away from the scene:';

/** The kinds' one line for the change-line instruction (SPEC §4.4). */
export const GRAMMAR = Object.freeze({
    away: '+ away Name — what they are doing | back: date (~ away Name to change it; ! away Name — where they got to; - away Name when they are back)',
    key: '- key Name | died (anyone who dies)',
});

/** The paragraph of the fixed prompt: no names, counts, times or dice. */
export const STATIC_TEXT = 'Key people are the people {{user}} follows. When one leaves the scene for a while, write an away line with what they do and when they should be back; write a step line when news of them comes; write - away Name when they return. Under [Key people] each away person has a line: let their story move on, and when one is due back, bring them back. Write - key Name | died only for a death.';
