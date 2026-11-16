// Ledger evidence reading: the evidence list of a raw record and parsing one evidence line.
import * as mechanics from '../core-mechanics.js';
import { profileDevelopmentText, profileDevelopmentSourceMessageId } from './values.js';

export function profileDevelopmentEvidence(field, raw = {}) {
    const evidence = raw?.evidence ?? raw?.profileEvidence ?? raw?.profile_evidence ?? raw?.observations ?? {};
    const values = Array.isArray(evidence?.[field]) ? evidence[field] : [];
    return values.map(item => profileDevelopmentText(field, item, mechanics.DURABLE_PROFILE_LIMITS.evidence)).filter(Boolean).slice(0, 8);
}

export function parseProfileDevelopmentEvidence(field, value) {
    let text = profileDevelopmentText(field, value, mechanics.DURABLE_PROFILE_LIMITS.evidence);
    if (!text) return null;
    const marker = text.match(/^\[m(\d+)\]\s*/i);
    const sourceMessageId = marker ? profileDevelopmentSourceMessageId(marker[1]) : null;
    if (marker) text = text.slice(marker[0].length).trim();
    if (!text) return null;
    const labeled = text.match(/^([\p{L}\p{N}][\p{L}\p{N} _\-/]{1,48})\s*:\s*(.+)$/u);
    const explicitConcept = labeled ? mechanics.normalizeName(labeled[1]).slice(0, 60) : '';
    // A Speech label is the style claim and a quoted line only illustrates it, so the label stays
    // in the body; a bare quote could never ground a description of how the NPC speaks.
    const quotedSpeech = field === 'speech' && labeled && /^["“‘'].*["”’']\W*$/u.test(labeled[2].trim());
    const body = profileDevelopmentText(field, quotedSpeech ? `${labeled[1].trim()} (${labeled[2].trim()})` : (labeled ? labeled[2] : text), mechanics.DURABLE_PROFILE_LIMITS.evidence);
    const concept = explicitConcept || mechanics.normalizeName(body).slice(0, 60);
    return body && concept ? { concept, explicitConcept, body, sourceMessageId } : null;
}
