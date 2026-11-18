// The job: checking two open packs together. Each pack is checked with the game's own checker (studio/check.js); only when both pass does the game's
// `checkPairing` run. With no game open the world is paired with the Built-in game. Pure: texts in, a plain answer out.
//
// pairPacks(worldText, gameText) → { ok, paired, against, blocked, errors, warnings, info, message }
//   `gameText` null/empty = the Built-in game. `blocked` lists the packs to fix first: [{ pack: 'world' | 'game', errors, message }].
//   `errors`/`warnings`/`info` are the pairing entries (empty unless `paired`), each with `pack` — the one to open for Go to: 'game' for a names
//   culture (it sits in the game pack's names), otherwise 'world'.

import { checkText } from './check.js';
import { validatePack, checkPairing } from '../packs/validate.js';

const NAMES = { world: 'The world pack', game: 'The game pack' };
const empty = { errors: [], warnings: [], info: [] };

function pending(pack, checked, kind) {
    if (!checked.ok) return { pack, errors: checked.errors.length, message: `${NAMES[pack]} has ${checked.errors.length} problem${checked.errors.length === 1 ? '' : 's'}; fix ${checked.errors.length === 1 ? 'it' : 'them'} first.` };
    const parsed = validatePack(String(checked.text));
    if (parsed.pack?.kind !== kind) return { pack, errors: 1, message: `${NAMES[pack]} is not a ${kind} pack (it says kind "${parsed.pack?.kind ?? 'none'}").` };
    return null;
}

const side = entry => ({ ...entry, pack: entry.part?.kind === 'culture' ? 'game' : 'world' });

/** Checks the world text and the game text (null = the Built-in game), then pairs them. */
export function pairPacks(worldText, gameText) {
    const builtIn = gameText == null || String(gameText).trim() === '';
    const against = builtIn ? 'the Built-in game' : 'the open game pack';
    const checks = [['world', worldText, 'world'], ...(builtIn ? [] : [['game', gameText, 'game']])]
        .map(([pack, text, kind]) => ({ pack, kind, checked: { ...checkText(text), text } }));
    const blocked = checks.map(({ pack, kind, checked }) => pending(pack, checked, kind)).filter(Boolean);
    if (blocked.length) return { ok: false, paired: false, against, blocked, ...empty, message: blocked.map(item => item.message).join(' ') };
    const [world, game] = [checks[0], checks[1]].map(item => item && validatePack(String(item.checked.text)).pack);
    const found = checkPairing(world, builtIn ? null : game);
    const [errors, warnings, info] = [found.errors, found.warnings, found.info].map(list => list.map(side));
    return { ok: errors.length === 0, paired: true, against, blocked: [], errors, warnings, info,
        message: errors.length ? `The world does not fit ${against}: ${errors.length} to fix.` : `The world fits ${against}.` };
}
