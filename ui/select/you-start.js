// The job: the "You and your start" rows on Settings › Start (format 4): the reader's own rank label and starting money and items, each saying what blank means.

import { itemsText } from '../../packs/own.js';

const GROUP = 'You and your start';
const row = (key, type, label, value, hint, extra = {}) => ({ key, group: GROUP, type, label, hint, value, default: type === 'num' ? null : '', options: extra.options ?? null, unit: extra.unit ?? null, tags: [], wide: false });

// The name of the coin the wallet counts in (the smallest): the reader's Money settings as the engine reads them (the reader's coins, else the chat's game, else the one currency word).
const coinOf = money => {
  const coins = Array.isArray(money?.coins) ? money.coins : [];
  const first = coins.length ? coins[0]?.name : money?.currency;
  return typeof first === 'string' && first.trim() ? first.trim() : '';
};

/** `own` = the `packs.own` answer `{ own, game }`; `money` = Story Block's settings as the Money page reads them. → the three rows; `game` (the selected game pack's values) or its absence (the built-in game) fills the "Blank: …" hints. */
export function selectYouStartRows(own, money = null) {
  const v = own && typeof own === 'object' ? own : {};
  const mine = v.own && typeof v.own === 'object' ? v.own : { rankLabel: '', money: null, items: [] };
  const game = v.game && typeof v.game === 'object' ? v.game : null;
  const of = text => (game ? `Blank: the game pack’s (${game.name}: ${text})` : 'Blank: none (the built-in game has none)');
  const coin = coinOf(money) || game?.coin || 'gold';
  return [
    row('packs.you.rankLabel', 'txt', 'Rank label', mine.rankLabel, `What your rank is called. ${of(game?.rankLabel || 'no rank')}`),
    row('packs.start.money', 'num', 'Starting money', mine.money, `For new chats, in the smallest coin. ${of(Number.isInteger(game?.money) ? `${game.money} ${coin}` : 'none')}`, { unit: coin }),
    row('packs.start.items', 'lines', 'Starting items', itemsText(mine.items), `For new chats; your list replaces the game pack’s (${game ? `${game.name}: ${game.items?.length ? game.items.join(', ') : 'none'}` : 'the built-in game: none'})`, { options: ['Edit list'] }),
  ];
}
