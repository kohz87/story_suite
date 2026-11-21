// The horde words the narrator wrote on the Foes block (its `kind: horde` line: `waves`, `hold` (0 = none), `leader` ("none" = no leader); templates-parts/v1-foes.js),
// read when a fight opens on that block's groups. Any clear of a slot forgets them, so stale words never reach a later fight. Pure: it reads the state it is given.
import { wordsOf } from './horde-build.js';

const NO_LEADER = new Set(['', 'none', 'no', 'nobody', 'no one', '-', 'n/a']);

/** `{ waves, until, hold?, leader? }` (horde-build.js wordsOf) from the Foes block that holds the fight's slots (`foes`: readSheet's filled v1 slots), or null when it holds none. */
export function blockWords(state, foes) {
    const module = (Array.isArray(foes) ? foes : []).find(foe => foe?.module)?.module;
    const fields = module ? state?.domains?.dataModules?.instances?.[module]?.chat?.fields : null;
    if (!fields || !(Number(fields.waves) > 0)) return null;
    const hold = Number(fields.hold) > 0 ? Number(fields.hold) : 0, leader = String(fields.leader ?? '').trim();
    return wordsOf({ waves: Number(fields.waves), until: hold ? 'hold' : 'clear', ...(hold ? { hold } : {}), ...(NO_LEADER.has(leader.toLowerCase()) ? {} : { leader }) });
}
