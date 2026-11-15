import { mergeScanResult } from '../core.js';

export function gradualSpeechUpdate(npc, evidence, speech = 'Confident and direct; speaks in concise sentences without habitual hedging.') {
    return {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            evidence: { speech: [evidence] },
            speechState: 'evolve',
            speech,
            speechReason: 'Her direct delivery has become a recurring speech habit.',
            developmentScale: 'gradual',
            developmentReason: 'Repeated later scenes show the same speech habit.',
        }],
    };
}

export function scan(state, payload, turn, sourceMessageId, developmentContext = 'She answers directly and without hedging.') {
    return mergeScanResult(state, payload, { turn, sourceMessageId, developmentContext });
}
