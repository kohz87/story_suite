// Fixed words of the cue: wear lines, outcome words, token count and recovery words.

export const wearLine = ({ item, to }) => `${item} ${to === 'broken' ? 'breaks' : 'is worn'} (${to[0].toUpperCase() + to.slice(1)})`;
export const OUTCOME_WORD = Object.freeze({ success: 'SUCCESS', cost: 'SUCCESS AT A COST', fail: 'FAIL' });

/** Tokens as the prompt budget counts them (§5): about four characters each. */
export const cueTokens = text => Math.ceil(String(text ?? '').length / 4);

/** The words of a recovery for the log and the note: "+3 health". */
export const recoveryWords = (pool, gained) => `+${gained} ${pool}`;
