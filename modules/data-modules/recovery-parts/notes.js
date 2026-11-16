// The notes the reader sees when a recovery line is not used, and the too-soon check for a full rest.
import { FULL_REST_HOURS } from './constants.js';

const NAME = { health: 'Health', stamina: 'Stamina', mana: 'Mana' };
/** The notes (Problems lines), named for the character. */
export const recoveryNote = {
    xp: who => `${who}: XP comes from fights only, so this line was not used.`,
    raised: (who, bar) => (bar === 'health' ? `${who}: Health was not raised. It needs a full rest or a heal.`
        : `${who}: ${NAME[bar]} was not raised. A short rest refills it.`),
    fullRest: who => `${who}: full rest refused. The last one was under ${FULL_REST_HOURS} story hours ago.`,
};

/** Whether a story full rest is too soon: the clock reads `now` (story minutes, null = no clock) and `last` is the stored mark. */
export const fullRestTooSoon = (now, last, known = undefined) => Number.isSafeInteger(now) && Number.isSafeInteger(last)
    && (known === undefined ? last > 0 && now - (last - 1) < FULL_REST_HOURS * 60 : known === true && now - last < FULL_REST_HOURS * 60);
