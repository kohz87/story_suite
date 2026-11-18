// The job: put the purse's smallest unit after a reply's coin change ("−3" becomes "−3 copper"), the unit the engine counts that change in.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');

/** `line` is the signed number (`+30`, `−3`); the unit is the smallest coin of `inventory.currency` (else the currency's own name), plural unless it is one. */
export function withCoinUnit(line, currency) {
  const amount = Number(String(line).replace('−', '-'));
  if (!Number.isFinite(amount) || !/^[+−-]?\d+$/u.test(line)) return line;
  const coins = (Array.isArray(currency?.coins) ? currency.coins : []).filter(coin => isRec(coin) && coin.value > 0);
  const base = [...coins].sort((a, b) => a.value - b.value)[0] ?? currency;
  const unit = Math.abs(amount) === 1 ? text(base?.name) : text(base?.plural) || text(base?.name);
  return unit ? `${line} ${unit}` : line;
}
