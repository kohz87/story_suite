// The current exchange as text: labelled transcript, bare story bodies and the story prose with speakers.
import { storyProse } from '../../core.js';
import { currentExchangeMessages } from './exchange.js';
import { cleanMessage } from './shared-clean.js';
import { recentTranscript } from './recent.js';
import { readContext } from './source.js';

export function currentExchangeTranscript(messageId = null) {
    const messages = currentExchangeMessages(messageId);
    if (!messages) return recentTranscript(2);
    return messages.map(cleanMessage).filter(Boolean).join('\n');
}

// The story text of the current exchange (the user message and the reply), without speaker labels: for cheap local checks.
export function currentExchangeBodies(messageId = null) {
    return (currentExchangeMessages(messageId) || []).map(message => storyProse(message.mes || '')).filter(Boolean);
}

// (1.2.12) The current exchange's story alone (narration and dialogue, no World State or blocks):
// who a relationship moment involves, and what the relationship evaluator is sent.
export function currentExchangeProse(messageId = null) {
    const ctx = readContext();
    return (currentExchangeMessages(messageId) || []).map(message => {
        const body = storyProse(message.mes || '');
        const speaker = message.name || (message.is_user ? ctx.name1 : ctx.name2) || '';
        return body ? `${speaker}: ${body}` : '';
    }).filter(Boolean).join('\n');
}
