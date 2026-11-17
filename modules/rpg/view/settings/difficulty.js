// Draws the RPG settings Difficulty card: the chosen difficulty and the Custom numbers of the formula in force.

import { h } from '../../../../ui/legacy/view/widgets/dom.js';
import { LEVEL } from '../../names.js';
import { DIFFICULTIES, DIFFICULTY_SETTING, STANDARD_RANGES, STANDARD_SETTING, difficultyOf, normalizeStandard } from '../../rules.js';
import { fill } from '../../strings.js';
import { customOf, soulLabelFor } from '../settings-data.js';
import { S, SETTINGS_MODULE, STANDARD_FIELDS } from './constants.js';

export function createDifficultySection({ doc, card, chips, field, packNote, values, settings, put, live, pack, headState, readerName }) {
    function drawDifficulty() {
        const box = card('difficulty', S.difficulty);
        const now = difficultyOf(values());
        // The Custom numbers (Standard's thirteen) are kept in `rpgStandard`.
        const customKey = STANDARD_SETTING, fields = STANDARD_FIELDS, ranges = STANDARD_RANGES;
        chips(box, S.difficulty, DIFFICULTIES.map(name => [name, S[name]]), now, value => {
            // A first switch to Custom starts from the numbers in force, so nothing jumps.
            if (value === 'custom' && !values()[customKey]) settings.set(SETTINGS_MODULE, customKey, customOf(values(), pack()));
            put(DIFFICULTY_SETTING, value);
        });
        const numbersFromPack = packNote('numbers');
        if (numbersFromPack) box.appendChild(numbersFromPack);
        if (now === 'custom') {
            const grid = h(doc, 'div', 'rpg-set-nums');
            const custom = customOf(values(), pack());
            const soulLabel = soulLabelFor(headState(), readerName());
            for (const entry of fields) {
                const label = fill(entry.label, { label: soulLabel });
                const range = ranges[entry.key], slot = field(grid, label, entry.help);
                let input;
                if (entry.options) {
                    input = doc.createElement('select');
                    for (const [value, text] of entry.options) {
                        const option = doc.createElement('option');
                        option.value = String(value);
                        option.textContent = text;
                        input.appendChild(option);
                    }
                    input.value = String(custom[entry.key] ?? LEVEL.divisor);
                } else {
                    input = doc.createElement('input');
                    input.setAttribute('type', 'number');
                    input.setAttribute('min', String(range.min));
                    input.setAttribute('max', String(range.max));
                    input.setAttribute('step', '1');
                    input.setAttribute('inputmode', 'numeric');
                    input.value = String(custom[entry.key]);
                }
                input.setAttribute('data-rule', entry.key);
                input.setAttribute('aria-label', label);
                input.className = 'rpg-set-input';
                input.addEventListener('change', () => {
                    const have = customOf(values(), pack()), typed = Number(String(input.value).trim());
                    // A number outside its range is held to it; something that is not a number is put back.
                    // (A choice is one of its options, kept as it is.)
                    const next = entry.options ? (entry.options.some(([value]) => value === typed) ? typed : have[entry.key] ?? LEVEL.divisor)
                        : Number.isFinite(typed) && String(input.value).trim() !== '' ? Math.min(range.max, Math.max(range.min, Math.round(typed))) : have[entry.key];
                    input.value = String(next);
                    put(customKey, normalizeStandard({ ...have, [entry.key]: next }));
                    live();
                });
                slot.add(input);
            }
            box.appendChild(grid);
        }
        box.appendChild(h(doc, 'p', 'rpg-set-help', S.replayNote));
    }

    return { drawDifficulty };
}
