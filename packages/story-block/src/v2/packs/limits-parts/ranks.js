// Field names, id pattern and limits of a ladder of ranks.

export const RANK_FIELDS = Object.freeze(['id', 'title', 'levels', 'reward', 'xp']);
export const RANK_ID = /^[\p{L}\p{N}+-]{1,8}$/u;
export const RANKS_LIMITS = Object.freeze({ records: 12, title: 30, level: 999, xp: 1000000 });
