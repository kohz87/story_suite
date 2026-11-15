// The failure a call raises and how an error's words are made safe to show.

import { cutAt } from '../../text.js';

// A failure the call itself raised, with a plain sentence (st's own words stay out of it when they
// may say more than they should: only the first line, cut short, with anything key-like masked).
export class CallError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const KEYLIKE = /\b(?:sk|pk|key|api|bearer)[-_ ]?[A-Za-z0-9_-]{8,}|[A-Za-z0-9_-]{32,}/gi;

/** An error's words as safe to show: its first line (or its cause's), cut at 160, key-like runs masked. */
export function safeReason(error) {
    const raw = error?.cause?.message ?? error?.message ?? (typeof error === 'string' ? error : '');
    const line = String(raw ?? '').split(/\r?\n/)[0].replace(KEYLIKE, '…').trim();
    return cutAt(line || 'no reason given', 160);
}
