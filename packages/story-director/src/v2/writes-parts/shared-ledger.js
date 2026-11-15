// Story Director v2, retry ledger: the write-id pattern, the ledger size limit and the record test its parts share.

export const WRITE_ID = /^[a-z]{2}_[0-9a-z]{8}$/;
export const WRITES_LIMIT = 200;

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
