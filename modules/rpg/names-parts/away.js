// Names: the two settings for a companion who is away (Settings → RPG), both off unless set.

/** Away companions (Settings → RPG): `rpgAwayWait` (bool, off) a companion the story has away sits out fights and shows as away on the Party sheet; `rpgAwayXp` (percent 0 to 100, 0) what such a companion is paid of a won fight's XP. */
export const AWAY_WAIT_SETTING = 'rpgAwayWait';
export const AWAY_XP_SETTING = 'rpgAwayXp';
/** `{ wait, xp }` the settings say: `xp` is a whole percent from 0 to 100, and counts only while `wait` is on. */
export function awayFrom(values) {
    const wait = values?.[AWAY_WAIT_SETTING] === true, raw = values?.[AWAY_XP_SETTING];
    return { wait, xp: wait && Number.isInteger(raw) && raw > 0 ? Math.min(100, raw) : 0 };
}
