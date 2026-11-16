// Story Director: token allowance and token-count estimation for note parts.

import { estimateTokens } from '../relevance.js';

// What the model is allowed for writing the change lines the instruction asks for, in tokens:
// the two tags and about two lines of 20 to 25 tokens, a usual reply's worth. A rough
// allowance for the reader, not a limit.
export const DIRECTOR_OUTPUT_TOKENS = 60;

/**
 * The tokens (≈ 4 characters each) a note adds to the next reply: `input` the note's parts,
 * `output` DIRECTOR_OUTPUT_TOKENS for the change lines while it asks for them (on its Change
 * instruction part), 0 when it does not (a capture call writes them, and is not counted).
 * Plain `{ input, output, parts: [{ label, input, output }] }`.
 */
export function noteTokens(parts, { outputTokens = DIRECTOR_OUTPUT_TOKENS } = {}) {
    const allowance = Number(outputTokens) >= 0 ? Math.round(Number(outputTokens)) : DIRECTOR_OUTPUT_TOKENS;
    const counted = (Array.isArray(parts) ? parts : [])
        .filter(entry => entry && String(entry.text ?? ''))
        .map(entry => ({
            label: String(entry.label ?? ''),
            input: estimateTokens(entry.text),
            output: entry.label === 'Change instruction' ? allowance : 0,
        }));
    return {
        input: counted.reduce((sum, entry) => sum + entry.input, 0),
        output: counted.reduce((sum, entry) => sum + entry.output, 0),
        parts: counted,
    };
}
