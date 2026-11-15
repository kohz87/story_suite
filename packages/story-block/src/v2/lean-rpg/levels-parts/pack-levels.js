// Levels: what a pack says of levels, and the `rpg.rank` query.

import { isObject, whole } from './shared-guards.js';
import { LEVEL_MAX, LEVEL_MIN } from './bounds.js';
import { bandsOf, rankOf } from './ranks.js';

/** The query `rpg.rank { level }` → { name } | null. */
export const RANK_QUERY = 'rpg.rank';

/**
 * The current value of the pack's player-rank field: the chat block whose slug is `playerRank.module`, read through the data-modules view
 * (`query('dataModules.view', { module })`, a chat block's `{ chat: fields }`; without `query` the state's own instance), else null; null too while the block has `registered: false`.
 */
export function playerRankValue(state, playerRank, query) {
    try {
        if (!isObject(playerRank) || typeof playerRank.module !== 'string' || typeof playerRank.field !== 'string') return null;
        const wanted = playerRank.module.trim().toLowerCase();
        const id = Object.keys(state?.domains?.dataModules?.active ?? {}).find(key => key === wanted || key.split('/')[1] === wanted);
        if (!id) return null;
        const view = typeof query === 'function' ? query('dataModules.view', { module: id }) : { chat: state.domains.dataModules.instances?.[id]?.chat?.fields };
        // A rank block that says it has not been joined yet (a boolean `registered` that is false: Ersveil's Guild before anyone registers) names no rank: its letter is a default, not a standing.
        if (view?.chat?.registered === false) return null;
        const value = view?.chat?.[playerRank.field];
        return typeof value === 'string' || typeof value === 'number' ? value : null;
    } catch { return null; }
}

/** What a pack says of levels, from its `content.rpg` records (the one with the slug `ranks`): { ranks?, levelCap? }, or null. */
export function packLevelsOf(records) {
    const found = (Array.isArray(records) ? records : []).find(record => isObject(record) && record.slug === 'ranks');
    if (!found) return null;
    const ranks = bandsOf(found.ranks);
    return { ...(ranks.length ? { ranks } : {}), ...(whole(found.levelCap) && found.levelCap >= LEVEL_MIN && found.levelCap <= LEVEL_MAX ? { levelCap: found.levelCap } : {}),
        ...(isObject(found.playerRank) && ['module', 'field', 'label'].every(key => typeof found.playerRank[key] === 'string' && found.playerRank[key]) ? { playerRank: { module: found.playerRank.module, field: found.playerRank.field, label: found.playerRank.label } } : {}) };
}

/** The query function: `rpg.rank { level, ranks? }` → { name } | null. Without `ranks` in the arguments it reads the packs' (`packs.content` of kind rpg). */
export function rankQuery(_state, args, tools) {
    let ranks = args?.ranks;
    if (ranks === undefined) {
        let found = null;
        try { found = packLevelsOf(tools?.query?.('packs.content', { kind: 'rpg' })); } catch { found = null; }
        ranks = found?.ranks;
    }
    const rank = rankOf(args?.level, ranks);
    return rank ? { name: rank.name } : null;
}
