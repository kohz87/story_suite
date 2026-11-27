// The module's settings: tone preset, the survival switch and the stat names, and the tone's step.
import { MODULE_ID } from './constants.js';
import { STATIC_TEXT } from './static-text.js';

const RULES_MAX = 2500;

const TONES = Object.freeze({ gritty: 1, standard: 0, heroic: -1 });

/** The settings block for registerModule. */
export const SETTINGS = Object.freeze({
    section: 'Text RPG',
    defaults: { tone: 'standard', survival: false, statNames: 'STR, VIT, AGI, DEX, INT, WIS, CHA', levelCap: 99, xpRate: '100', rules: '' },
    schema: {
        tone: {
            type: 'choice', label: 'Text RPG: Tone', feature: 'text-rpg.on',
            options: [
                { value: 'gritty', label: 'Gritty (one step harder, injuries likelier)' },
                { value: 'standard', label: 'Standard' },
                { value: 'heroic', label: 'Heroic (one step easier)' },
            ],
        },
        survival: { type: 'bool', label: 'Text RPG: Survival (hunger, thirst and warmth)', feature: 'text-rpg.on' },
        statNames: { type: 'text', label: 'Text RPG: Stat names, in order', max: 80, feature: 'text-rpg.on' },
        levelCap: {
            type: 'int', min: 1, max: 99, label: 'Text RPG: Level cap', feature: 'text-rpg.on',
            help: 'The highest level a character can reach, 1 to 99 (default 99): XP stops adding levels above it. A reply uses the cap it was written under.',
        },
        xpRate: {
            type: 'choice', label: 'Text RPG: XP rate', feature: 'text-rpg.on',
            options: Array.from({ length: 11 }, (_, at) => ({ value: String(50 + at * 25), label: `${50 + at * 25}%` })),
            help: 'Every xp gain is multiplied by it: 50 to 300 %, in steps of 25, default 100. A reply uses the rate it was written under.',
        },
        // Empty: the built-in rules. The Rules page draws it with the prompt editor, prefilled with `builtin`.
        rules: {
            type: 'text', form: 'prompt', label: 'Text RPG: Narrator rules', max: RULES_MAX, builtin: STATIC_TEXT, feature: 'text-rpg.on',
            help: 'The dice and the ? try line are the code\'s: if the rules stop asking for ? try, rolls stop changing the sheet.',
        },
    },
});

/** The module's own settings values ({} when they cannot be read). */
export function ownSettings(source) {
    try { return source?.settings?.(MODULE_ID) ?? {}; } catch { return {}; }
}

/** How many difficulty steps the tone moves every roll: +1 gritty, 0 standard, -1 heroic. */
export function toneStep(source) {
    let values = null;
    try { values = source?.settings?.(MODULE_ID); } catch { values = null; }
    const step = TONES[values?.tone];
    return Number.isInteger(step) ? step : 0;
}
