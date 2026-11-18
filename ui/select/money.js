// Words for an amount of the chat's one currency ("5 marks", "3 silver 5 pennies"), shared by the Bag purse and the Journal's day money.

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// "5 marks": the chat's one currency (inventory.currency, answers.js:32), count-aware. With denominations (`currency.coins`: [{ name, plural, value }]) and no `display: 'base'`: largest first, "3 silver 5 pennies".
export function money(amount, currency) {
  if (!Number.isFinite(amount)) return '';
  const coins = Array.isArray(currency?.coins) ? currency.coins.filter(coin => isRecord(coin) && coin.value > 0) : [];
  const unit = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (coins.length) {
    const base = coins.find(coin => coin.value === 1) ?? coins[0];
    if (currency.display === 'base' || amount < 1) return unit(amount, base.name, base.plural || `${base.name}s`);
    const parts = [];
    let rest = Math.floor(amount);
    for (const coin of coins.filter((c, at) => coins.findIndex(o => o.value === c.value) === at).sort((a, b) => b.value - a.value)) {
      const n = Math.floor(rest / coin.value);
      if (n) parts.push(unit(n, coin.name, coin.plural || `${coin.name}s`));
      rest -= n * coin.value;
    }
    if (rest) parts.push(unit(rest, base.name, base.plural || `${base.name}s`));
    return parts.join(' ');
  }
  const name = currency?.name || 'coin';
  return unit(amount, name, currency?.plural || `${name}s`);
}
