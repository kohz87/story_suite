// Why the open fight can no longer be played on this sheet (the board's own words), or null: it was taken back, or the sheet or gear it read changed after its first exchange was staged.
import { hashJson } from '../../replay.js';
import { fightKind } from './interaction.js';

/** `session` is a `fightOf` view (its `witness` is the open interaction's: the hash of what the kind read when the first exchange was staged). */
export function sessionProblem(session, state) {
    if (session.invalidated) return 'The earlier fight was taken back. Restore that reply or discard this fight.';
    const witness = session.witness;
    return witness && witness.offset === session.setup.offset && hashJson(fightKind.witness(state, session.setup)) !== witness.hash
        ? 'The sheet or gear changed after the fight was rolled. Restore it or discard the fight (Fight tab, Discard fight).' : null;
}
