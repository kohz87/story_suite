// Money: one currency per chat (MODULES.md F1). The currency has one name, set in Story Block's
// settings (default 'gold'); the reader may rename it, never add a second. A wallet is one integer
// per owner under `coin`: wallets[owner] = { coin: 125 }. Pure.
//
// The name is singular ("1 mark"); the plural is its own setting, blank for the name + "s" ("44 marks",
// see pluralOf). The default, gold, has no plural form of its own ("44 gold").
//
// Coins (MODULES §F108): a world may count its one currency in coins of different worth ("copper: 1",
// "silver: 10", "gold: 100"): the reader's Coins setting, else the pack's `currency.coins` (when the pack's
// currency is in use), else none. The wallet still holds one whole number of the smallest unit (the
// coin worth 1); a written amount names at most one coin ("3 silver" is 30), which code turns into
// that unit before any budget or cap; amounts are shown in mixed coins ("3 silver 5 copper"), or in
// the smallest unit when the reader prefers (Coin display: base).
// Public face: re-exports its parts.

export { WALLET_KEY, DEFAULT_CURRENCY, MAX_COINS, MAX_COIN_VALUE } from './money-parts/constants.js';
export { pluralOf, coinPlural } from './money-parts/names.js';
export { coinsOf, currencyOf, resolveCurrency, baseUnit } from './money-parts/coins.js';
export { coinValue, isCurrencyName, countedMoney } from './money-parts/value.js';
export { foreignCoin } from './money-parts/foreign.js';
export { coinLine, moneyLine } from './money-parts/lines.js';
export { parseAmount, parseMixedAmount } from './money-parts/amount.js';
export { formatAmount, formatWallet } from './money-parts/format.js';
