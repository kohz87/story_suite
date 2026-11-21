// Who is away shows on the Party sheet only while Settings → RPG "Companions who are away wait" (`rpgAwayWait`, Story Block's bucket) is on.

/** The `rpg.sheet` rows with each row's `away` cleared unless `values` (Story Block's settings) turn the setting on. */
export const awayShown = (rows, values) => (Array.isArray(rows) && values?.rpgAwayWait !== true ? rows.map(row => (row && typeof row === 'object' ? { ...row, away: null } : row)) : rows);
