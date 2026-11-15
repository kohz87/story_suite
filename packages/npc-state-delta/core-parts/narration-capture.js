// The one-pass narration-capture prompt, split into cache-friendly rules and context parts.
import * as mechanics from '../core-mechanics.js';
import { buildScannerPrompt } from './scanner-prompts.js';

// The one-pass capture instruction rides in the roleplay injection: the same scanner rules and
// dossier context without a transcript (the roleplay model already sees the chat), plus a reminder.
export function buildNarrationCapturePrompt(options = {}) {
    return `${buildScannerPrompt({ ...options, fullScanMode: false, narrationCapture: true })}\n\n${mechanics.NARRATION_CAPTURE_REMINDER}`;
}
// (1.2.16) The same instruction in two parts for a cache-friendly prompt: the rules, which do not
// change from reply to reply, go early (byte-identical every armed reply, so providers can cache
// them with the rest of the prompt's head); the dossier context and the reminder, which change,
// go last. Split where the dossier context starts; nothing is added to or dropped from the text.
export const NARRATION_CAPTURE_CONTEXT_MARKER = 'Identity index (matching only):';
export const NARRATION_CAPTURE_TAIL_LEAD = 'NPC STATE DELTA ONE-PASS CAPTURE — context for the hidden block described in the system instructions:';
export function buildNarrationCaptureParts(options = {}) {
    const full = buildNarrationCapturePrompt(options);
    const at = full.indexOf(NARRATION_CAPTURE_CONTEXT_MARKER);
    if (at < 0) return { rules: '', context: full };
    return { rules: full.slice(0, at).trimEnd(), context: `${NARRATION_CAPTURE_TAIL_LEAD}\n${full.slice(at)}` };
}
