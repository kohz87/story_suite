// Checking whether an open quest is waiting for pay or looks finished, and formatting closing reasons.

import { LOOKS_OVER } from './over-patterns.js';

// (0.9.28) A step that is only the pay left to collect ("turn in voucher at the bailiff hatch",
// "collect the bounty from Verna"): the work is done. A time it was given is when the pay can be
// had, not a deadline the job can be failed by; and a failing reason that is only about time.
const PAY_WORDS = '(?:vouchers?|rewards?|bount(?:y|ies)|pay|payment|purse|coins?|fees?|chits?|tokens?|receipts?|scrip|silver|gold|copper|wages?)';
const CLAIM_STEP = new RegExp(`\\b(?:(?:turn|hand|cash|redeem|collect|claim|pick)(?:s|ed|ing)?(?: in| up)?|exchang(?:e|es|ed|ing))(?:\\s+[\\w'’-]+){0,2}?\\s+${PAY_WORDS}\\b|\\b(?:get|getting|be) paid\\b|\\b(?:return|go back|report)\\w*(?:\\s+[\\w'’-]+){0,4}?\\s+for\\s+(?:the |their |his |her |my |our )?${PAY_WORDS}\\b`, 'i');
export const TIME_FAIL = /\b(?:expired|missed|too late|deadline|lapsed|ran out|out of time|overdue|late\b|window (?:closed|passed|shut))/i;

/** (0.9.28) Whether an open quest's work is done and only its pay is left (its step or now says so). */
export function waitsForPay(record) {
    if (record?.kind !== 'quest' || record.status !== 'active') return false;
    return ['step', 'now'].some(field => CLAIM_STEP.test(String(record.fields?.[field] ?? '')));
}

/** Whether an open quest's step or now says it is over, so the note can ask the story to close it. */
export function looksFinished(record) {
    if (record?.kind !== 'quest' || record.status !== 'active') return false;
    return ['step', 'now'].some(field => LOOKS_OVER.test(String(record.fields?.[field] ?? '')));
}

// A `-` line's reason with its labelled parts ("failed: deadline passed"), as written.
export function closingReason(op) {
    const parts = Object.entries(op.extra ?? {}).map(([label, value]) => (String(value ?? '').trim() ? `${label}: ${value}` : label));
    return [String(op.reason ?? '').trim(), ...parts].filter(Boolean).join('; ');
}
