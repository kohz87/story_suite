// The send and start metadata keys, the opening keys a segment carries, and the plain-object test.
export const SEND = 'rpgFightSend', START = 'rpgFightStart';
export const OPENING_KEYS = ['opening', 'approach', 'drop', 'opened'];
export const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
