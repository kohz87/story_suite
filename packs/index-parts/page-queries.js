// The job: the Packs page's two answers: the selected pair's problems and suggestion (`packs.pairing`), and the reader's own start values beside the game pack's (`packs.own`).

import { satisfies } from '../version.js';
import { DEFAULT_CURRENCY } from '../../modules/inventory/money.js';

const named = pack => (pack ? { id: pack.id, name: pack.name || pack.id, version: pack.version } : null);

/**
 * `installed`: the store (installed.js). → `{ world, game, date, errors, warnings, recommends }`: the selected world and game (`{ id, name, version }` or null), the world's start date (or null), the pairing check's
 * errors and warnings for the pair (the built-in game when none), and the world's suggested game `{ id, version, name, installed, selected }` (`name`: the installed pack's, else the name the world wrote, else the id) (`installed` when a valid game pack of that
 * id in that range is installed; `selected` when it is the game in use), or null.
 */
export function pairingView(installed) {
    const picked = installed.selected(), packs = installed.packs();
    const world = picked.world ? packs.find(pack => pack.kind === 'world' && pack.id === picked.world) ?? null : null;
    const game = picked.game ? packs.find(pack => pack.kind === 'game' && pack.id === picked.game) ?? null : null;
    const { errors, warnings } = world ? installed.pair(world, game) : { errors: [], warnings: [] };
    const wanted = world?.recommends?.game ?? null;
    const have = wanted ? installed.list().find(row => row.kind === 'game' && !row.addOn && row.id === wanted.id && !row.problem && satisfies(row.version, wanted.version)) : null;
    return { world: named(world), game: named(game), date: world?.start?.date ?? null, errors, warnings, recommends: wanted ? { id: wanted.id, version: wanted.version, name: have?.name ?? (wanted.name || wanted.id), installed: Boolean(have), selected: game?.id === wanted.id } : null };
}

/** `installed`: the store. → `{ own: { rankLabel, money, items }, game: { name, rankLabel, money, coin, items } | null }`: what the reader set, and what the selected game pack gives (its smallest coin's name, for the money row). */
export function ownView(installed) {
    const game = installed.packs().find(pack => pack.kind === 'game' && pack.id === installed.selected().game) ?? null;
    const coins = game?.currency?.coins;
    const coin = (Array.isArray(coins) && coins.length ? coins[0].name : game?.currency?.name) || DEFAULT_CURRENCY.name;
    return {
        own: installed.own.read(),
        game: game ? { name: game.name || game.id, rankLabel: game.content?.you?.rank?.label ?? '', money: game.start?.money ?? null, coin, items: (game.start?.items ?? []).map(item => item.name) } : null,
    };
}
