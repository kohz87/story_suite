// Names: the Auto-fight exchange cap, its setting and reading.

/**
 * The setting (Settings → RPG → Fight board): the most exchanges Auto plays before it stops, 1 to 8, or 9 for "Until the end"; 3 unset.
 * `autoCapFrom(values)` is that number held to 1..9; `autoExchanges` is how many exchanges it allows (Infinity for 9).
 */
export const AUTO_CAP_SETTING = 'rpgAutoCap';
export const AUTO_CAP = Object.freeze({ min: 1, max: 9, default: 3, end: 9 });
export const autoCapFrom = values => (Number.isInteger(values?.[AUTO_CAP_SETTING]) && values[AUTO_CAP_SETTING] >= AUTO_CAP.min && values[AUTO_CAP_SETTING] <= AUTO_CAP.max
    ? values[AUTO_CAP_SETTING] : AUTO_CAP.default);

export const autoExchanges = cap => (cap >= AUTO_CAP.end ? Infinity : cap);
