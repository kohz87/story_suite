// Finds the settled fight records of a reply's receipts, whichever engine path wrote them.
// A fight is an `interaction.settle` receipt of the fight kind; it keeps its result under `data.v2` (the part the 200-carrier trim keeps), so a reader asks here.

/** The full kind id of the board fight on the interaction port. */
export const FIGHT_KIND = 'story-block/fight';
const SETTLE = 'interaction.settle';
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** True for a settled fight receipt: a settle of the fight kind (its opening settle too). Never reads `data.interaction`. */
export const isFightReceipt = receipt => receipt?.type === SETTLE && receipt.replan?.payload?.kindId === FIGHT_KIND;

/** True for any receipt that carries a roll record a reader may draw from: a fight settle. */
export const isRollReceipt = isFightReceipt;

/** The fight receipts among `receipts` in order, each with its `data.v2.result` (a receipt with no result record is left out). → [{ receipt, result }]. */
export function fightResults(receipts) {
    return (Array.isArray(receipts) ? receipts : []).flatMap(receipt => (isFightReceipt(receipt) && isObject(receipt.data?.v2?.result) ? [{ receipt, result: receipt.data.v2.result }] : []));
}
