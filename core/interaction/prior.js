// The opening prelude an earlier swipe of a reply settled (`{ payload, seed }`), read back from that swipe's own receipts for a swipe or regenerate.

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The earlier swipe's opening prelude, or null. The segment's own payload is `priorPayload` (send.js). */
export function priorOpening(message) {
    const records = [message?.extra?.storySuite, ...(Array.isArray(message?.swipe_info) ? message.swipe_info.map(info => info?.extra?.storySuite) : [])];
    const receipt = records.flatMap(record => record?.receipts ?? []).find(item => item?.type === 'interaction.settle' && plain(item.replan?.payload) && item.replan.payload.opening === true);
    return receipt ? { payload: structuredClone(receipt.replan.payload), seed: receipt.seed } : null;
}
