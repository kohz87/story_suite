// Field names and limits of the RPG ranks and the player-rank field.

// Ranks (`content.rpg.ranks`): names for bands of levels, `[{ name, from, to }]`, contiguous and ascending from 1, up to 99; `content.rpg.levelCap`: 1..99.
// Kept as one more record of the list, `{ id, slug: 'ranks', pack, ranks?, levelCap? }`, which the skill-set readers pass over.
export const RPG_RANK_FIELDS = Object.freeze(['name', 'from', 'to']);
export const RPG_RANK_LIMITS = Object.freeze({ entries: 20, name: 12, maxLevel: 99 });
// `content.rpg.playerRank`: { module, field, label } names a data-module field as the party's rank (shown "Lv 14 · Guild F"); module and field are text of 1 to `ref`, the label 1 to `label`.
export const RPG_PLAYER_RANK_FIELDS = Object.freeze(['module', 'field', 'label']);
export const RPG_PLAYER_RANK_LIMITS = Object.freeze({ ref: 40, label: 12 });
