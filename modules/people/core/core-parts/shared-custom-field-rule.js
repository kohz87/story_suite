// Shared custom-field prompt rule (with its Level exception) appended to the scanner-family prompts.
import * as mechanics from '../core-mechanics.js';

// User-defined custom fields (settings) add one rule and the current values of the NPCs in play.
// With no fields configured the prompt is unchanged.
// Owner-approved exception (core contract C10): only when the configured names include Level, one
// sentence lets that field be filled from a named rank or a direct comparison of strength. Other
// fields and prompts without Level are byte-identical. The cited line is prompt-only; the merge
// (core-record-custom-fields.js) asks only that an estimate not found in the text carries a reason.
export const LEVEL_FIELD_RULE = ' Level is the one exception: fill it when a line names that person\'s level or rank (a hedged "probably rank C or D" is written "C-D"), or directly compares their strength with the player character\'s ("far beyond anything I can sense"); then estimate from the story\'s rank scale if the prompt has one, else a number. Never from dramatic description without a comparison (an aura, a fearsome name, size, weapons), from a role alone, or from a character\'s own guess or boast in dialogue; narration and the player\'s declarative notes count, not quotes, questions or wishes. In customFieldsReason write Level: then the exact words of the line relied on, in quotes.';
export function appendCustomFieldRule(prompt, options = {}) {
    const names = mechanics.normalizeCustomFieldNames(options.customFieldNames);
    if (!names.length) return prompt;
    const roster = Array.isArray(options.existingNpcs) ? options.existingNpcs : [];
    const targets = options.targetNpc ? [options.targetNpc]
        : (options.existingNpc ? [options.existingNpc]
            : roster.filter(npc => npc?.present || mechanics.npcNamedInText(npc, options.transcript || '', roster)));
    const known = Object.fromEntries(targets.slice(0, 12)
        .map(npc => [npc?.id, mechanics.customFieldValues(npc, names)])
        .filter(([id, values]) => id && Object.keys(values).length));
    const example = Object.fromEntries(names.slice(0, 2).map(name => [name, 'value']));
    return `${prompt}

CUSTOM FIELDS (${names.join(', ')}): in an NPC row, "customFields":${JSON.stringify(example)} only when ${options.customFieldSource || 'the story or World State'} states that NPC's value explicitly. Keep-by-default: omit unchanged or unknown values; a changed established value needs "customFieldsReason". Never guess.${names.some(name => name.toLowerCase() === 'level') ? LEVEL_FIELD_RULE : ''}${Object.keys(known).length ? `\nEstablished custom fields: ${JSON.stringify(known)}` : ''}`;
}
