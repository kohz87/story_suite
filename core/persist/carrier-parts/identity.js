// Story Suite v2: what a carrier message is: the record key, the object test and a carrier's swipe index.

export const KEY = 'storySuite';

export const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

export const isCarrier = message => isObject(message) && !message.is_user;
export const swipeOf = message => (Number.isInteger(message?.swipe_id) ? message.swipe_id : 0);
