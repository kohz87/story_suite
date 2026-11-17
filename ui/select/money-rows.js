// The Money page's six rows (mock v7: Coins, Show money as, Money word, Plural, Short form, Price scale) from Story Block's stored money settings.

import { CORE_SETTINGS } from '../../modules/scene/domains/core/constants-parts/settings.js';
import { coinsText } from './money-lines.js';

/** The stored key behind each row key (the keys the old view's Money page writes through `settings.set('story-block', key, value)`). */
export const MONEY_KEYS = Object.freeze({
  'money.coins': 'coins', 'money.show': 'coinDisplay', 'money.moneyWord': 'currency', 'money.plural': 'currencyPlural', 'money.shortForm': 'currencyShort', 'money.priceScale': 'economyScale',
});
/** The two display words and the stored choice behind each. */
export const SHOW = Object.freeze({ 'Each coin': 'mixed', 'Smallest coin only': 'base' });

const D = CORE_SETTINGS.defaults;
const wordOf = stored => Object.keys(SHOW).find(word => SHOW[word] === stored) ?? 'Each coin';
const scaleOf = stored => { const n = Number(stored); return Number.isFinite(n) ? n : 0; };
const row = (key, type, label, value, dflt, extra = {}) => ({ key, group: 'Coins', type, label, hint: extra.hint ?? null, value, default: dflt, options: extra.options ?? null, unit: null, tags: [], wide: false });

/** `money` = Story Block's settings (stored over defaults). → the Money section's rows; a gap gives the defaults. */
export function selectMoneyRows(money) {
  const m = money && typeof money === 'object' ? money : {};
  const get = key => (Object.hasOwn(m, key) ? m[key] : D[key]);
  const text = key => String(get(key) ?? '');
  const coinsHint = 'Blank: the pack’s coins (Ersveil: copper, silver, gold)';
  return [
    row('money.coins', 'txt', 'Coins, smallest first', coinsText(get('coins')), '', { hint: coinsHint }),
    row('money.show', 'seg', 'Show money as', wordOf(get('coinDisplay')), wordOf(D.coinDisplay), { options: Object.keys(SHOW) }),
    row('money.moneyWord', 'txt', 'Money word', text('currency'), D.currency, { hint: 'For a one-coin world: mark, crown…' }),
    row('money.plural', 'txt', 'Plural', text('currencyPlural'), D.currencyPlural, { hint: 'blank: the word with an s' }),
    row('money.shortForm', 'txt', 'Short form', text('currencyShort'), D.currencyShort, { hint: 'blank: its first letter' }),
    row('money.priceScale', 'num', 'Price scale', scaleOf(get('economyScale')), scaleOf(D.economyScale), { hint: '0 keeps the pack’s prices' }),
  ];
}
