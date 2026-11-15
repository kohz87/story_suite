// Estimates the tokens Delta adds to one reply, from the injection's sections and the capture block.
import { tokensFor } from './shared-tokens.js';
const MENTIONED_PREFIX = 'MENTIONED, NOT PRESENT:';
const DECEASED_PREFIX = 'DECEASED, REFERENCED ONLY:';
const RUBRIC_PREFIX = 'RELATIONSHIP-TO-BEHAVIOR RUBRIC:';

/**
 * The dossier injection split into its sections, as { label, chars }: the instructions header,
 * the present NPC cards, mentioned-not-present lines, deceased references and the relationship
 * rubric, in the order they appear. Empty sections are left out.
 */
export function injectionSections(text) {
    const order = ['Dossier instructions', 'Present NPC cards', 'Mentioned NPCs', 'Deceased references', 'Relationship rubric'];
    const chars = new Map();
    let section = order[0];
    const lines = String(text ?? '').split('\n');
    lines.forEach((line, index) => {
        if (line.startsWith(MENTIONED_PREFIX)) section = order[2];
        else if (line.startsWith(DECEASED_PREFIX)) section = order[3];
        else if (line.startsWith(RUBRIC_PREFIX)) section = order[4];
        else if (line.startsWith('- ') && section === order[0]) section = order[1];
        if (!line && lines.length === 1) return;
        chars.set(section, (chars.get(section) || 0) + line.length + (index ? 1 : 0));
    });
    return order.filter(label => chars.get(label)).map(label => ({ label, chars: chars.get(label) }));
}

/**
 * { input, output, parts: [{ label, input, output }] } for what Delta adds to one ordinary reply:
 * the injection's sections, plus the one-pass capture instruction (input) and its block (output)
 * when capture is on. Totals are the sums of the parts. Never throws.
 */
export function replyTokenEstimate({ injection = '', captureChars = 0, captureOutputChars = 0 } = {}) {
    try {
        const parts = injectionSections(injection).map(({ label, chars }) => ({ label, input: tokensFor(chars), output: 0 }));
        if (Number(captureChars) > 0) {
            // (1.2.13) Its own slot at the end of the prompt, apart from the dossier.
            parts.push({ label: 'One-pass capture instruction', input: tokensFor(Number(captureChars)), output: 0 });
            parts.push({ label: 'One-pass capture block', input: 0, output: tokensFor(captureOutputChars) });
        }
        const sum = key => parts.reduce((total, part) => total + part[key], 0);
        return { input: sum('input'), output: sum('output'), parts };
    } catch {
        return { input: 0, output: 0, parts: [] };
    }
}

/** A plain copy of an estimate: whole non-negative numbers, totals recomputed from the parts. */
export function copyTokenEstimate(estimate) {
    const count = value => Math.max(0, Math.round(Number(value) || 0));
    const parts = (Array.isArray(estimate?.parts) ? estimate.parts : [])
        .filter(part => part && typeof part === 'object')
        .map(part => ({ label: String(part.label ?? ''), input: count(part.input), output: count(part.output) }));
    const sum = key => parts.reduce((total, part) => total + part[key], 0);
    return { input: sum('input'), output: sum('output'), parts };
}
