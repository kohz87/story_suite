// The wallet key, the default currency and the caps on a currency's coins.

export const WALLET_KEY = 'coin';

export const DEFAULT_CURRENCY = Object.freeze({ name: 'gold', plural: 'gold', short: 'g' });

// The most coins a currency has, and the most one is worth in the smallest unit.
export const MAX_COINS = 8;

export const MAX_COIN_VALUE = 1_000_000;
