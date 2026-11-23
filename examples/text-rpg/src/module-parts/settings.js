// The module's settings: tone preset, the survival switch and the stat names, and the tone's step.
import { MODULE_ID } from './constants.js';

const TONES = Object.freeze({ gritty: 1, standard: 0, heroic: -1 });

/** The settings block for registerModule. */
export const SETTINGS = Object.freeze({
    section: 'Text RPG',
    defaults: { tone: 'standard', survival: false, statNames: 'STR, VIT, AGI, DEX, INT, WIS, CHA' },
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
    },
});

/** How many difficulty steps the tone moves every roll: +1 gritty, 0 standard, -1 heroic. */
export function toneStep(source) {
    let values = null;
    try { values = source?.settings?.(MODULE_ID); } catch { values = null; }
    const step = TONES[values?.tone];
    return Number.isInteger(step) ? step : 0;
}
