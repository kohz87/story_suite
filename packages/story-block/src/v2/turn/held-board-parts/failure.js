// The advice that ends a fight failure: restore the sheet or gear, or discard the fight.

/** The "restore or discard" advice that ends a fight failure (none when the message already says discard). */
export const restoreHint = (detail, tail = '.') => (/discard/i.test(detail) ? '' : ` Restore the sheet or gear, or discard the fight (Fight tab, Discard fight)${tail}`);

/** "<lead> <reason>. Restore the sheet or gear, or discard the fight (Fight tab, Discard fight)." for a fight that could not be saved or prepared. */
export function boardFailure(lead, message) {
    const detail = String(message ?? 'unknown error').trim().replace(/[.\s]+$/u, '');
    return `${lead} ${detail}.${restoreHint(detail)}`;
}
