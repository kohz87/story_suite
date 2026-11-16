// The provenance hint of the chat being branched: the shared value and its setter.

export let provenanceHint = Object.freeze({ mainChat: '', ownerScope: '', currentKey: '' });

export function setBranchProvenanceHint({ mainChat = '', ownerScope = '', currentKey = '' } = {}) {
    provenanceHint = Object.freeze({
        mainChat: String(mainChat || '').replace(/\.jsonl$/i, '').trim(),
        ownerScope: String(ownerScope || '').trim(),
        currentKey: String(currentKey || '').trim(),
    });
}
