// Identity basics shared by the identity parts: the np_ pattern, the empty identity, the name key and the record test.

export const NP_ID = /^np_[0-9a-z]{8}$/;

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const emptyIdentity = () => ({ map: {}, byKey: {} });

/** The key a name is found by: invisible marks dropped, NFKC, apostrophes dropped, spaces folded, lowercase. */
export const nameKey = value => String(value ?? '').replace(/\p{Cf}+/gu, '').normalize('NFKC').replace(/['’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
