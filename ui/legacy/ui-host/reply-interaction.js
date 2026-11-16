// What a settle changed, for the reply card: one entry per settle receipt of the shown swipe's record.
// Display only. A receipt older than the carrier window keeps its `summary` line but not `data.interaction` (persist/receipts.js),
// so such an entry has the summary alone: no kind name, no change list.

const SETTLE = 'interaction.settle';

/** [{ kind, summary, changes: [{ type, summary }] }] for a reply record's settle receipts, in receipt order. */
export function interactionAt(record) {
    const out = [];
    for (const receipt of Array.isArray(record?.receipts) ? record.receipts : []) {
        if (receipt?.type !== SETTLE) continue;
        const shown = receipt.data?.interaction;
        const changes = (Array.isArray(shown?.changes) ? shown.changes : [])
            .filter(change => change && typeof change === 'object')
            .map(change => ({ type: String(change.type ?? ''), summary: String(change.summary ?? '') }))
            .filter(change => change.summary !== '');
        out.push({ kind: typeof shown?.kind === 'string' ? shown.kind : '', summary: String(receipt.summary ?? ''), changes });
    }
    return out;
}
