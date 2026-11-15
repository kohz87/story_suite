// Two small value helpers shared by the checkpoint parts: the record test and the plain-JSON copy.

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const plain = value => JSON.parse(JSON.stringify(value ?? null));
