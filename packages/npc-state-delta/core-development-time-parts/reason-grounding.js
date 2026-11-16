/* NPC State Delta development-reason grounding: checks that a stated reason shares content with the source text. */

import { cleanText } from '../core-text.js';
import { developmentContentTokens } from './shared-content-tokens.js';

export function developmentReasonGrounded(reason, context, { strong = false } = {}) {
    const why = cleanText(reason, 500);
    const source = String(context || '').trim();
    if (!why) return false;
    if (!source) return true; // library/API compatibility; runtime supplies source context.
    const sourceTokens = new Set(developmentContentTokens(source));
    const reasonTokens = developmentContentTokens(why);
    if (!reasonTokens.length) return false;
    const matches = reasonTokens.filter(token => sourceTokens.has(token)).length;
    const required = strong && reasonTokens.length > 2 ? 2 : 1;
    return matches >= required;
}

export function contextWindowGroundsReason(reason, value, strong = false) {
    const reasonTokens = developmentContentTokens(reason);
    if (!reasonTokens.length) return false;
    const sourceTokens = new Set(developmentContentTokens(value));
    const matches = reasonTokens.filter(token => sourceTokens.has(token)).length;
    const required = strong && reasonTokens.length > 2 ? 2 : 1;
    return matches >= required;
}
