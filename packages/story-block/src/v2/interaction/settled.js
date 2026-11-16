// The query a settle asks for a carried segment's earlier receipt: the stored settle receipts of one key, as the transaction sees them
// (on a re-plan, the receipts before the block, not the store's list). The command's ctx has no receipts of its own, only query tools do.

const SETTLE = 'interaction.settle';
export const SETTLED = 'interaction.settled';

export const settledQuery = (_state, args, tools) => (typeof args?.key === 'string'
    ? tools.receipts().filter(entry => (entry?.receipt ?? entry)?.type === SETTLE && (entry?.receipt ?? entry)?.replan?.payload?.key === args.key) : []);
