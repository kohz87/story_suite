// Opens a board fight on a reply, stages exchanges on it, and discards it.
import { hardFightFor } from '../flags.js';
import { readSheet } from '../../read.js';
import { fightSeed } from '../dice.js';
import { boardWitness, playBoard } from '../engine.js';
import { boardFlags } from '../overrides.js';
import { resumeMembers } from '../resume.js';
import { ATTEMPTS, KEY } from './shared-keys.js';
import { SEND, START, object } from './shared-meta.js';
import { boardSession } from './current.js';

// The harder-foes rule (setup.foesHard = 1) starts a fight only when every foe on the sheet is of a new Foes block (read.js `hard`) and the fight also has the doubled bars (every character scale 2: the rule's hits are tuned for that Health); otherwise the fight keeps the old numbers.
const doubled = sheet => sheet.characters.length > 0 && sheet.characters.every(actor => actor.scale === 2);
const hardFoes = sheet => sheet.foes.some(foe => foe.filled) && hardFightFor(sheet);
/** Open on a carrier: its ID and discard count determine the fight's seed. */
export function openBoard(meta, state, { sid, rules, gear = null, weapons = {}, records = [] } = {}) {
    if (!object(meta) || typeof sid !== 'string' || !sid) return { error: 'There is no reply to open a fight from.' };
    const sheet = readSheet(state), groups = sheet.foes.filter(foe => foe.filled && foe.hurt > 0).map(foe => foe.slot);
    if (!sheet.characters.some(actor => actor.alive !== false && actor.health !== 0) || !groups.length) return { error: 'There is no fight to open.' };
    const attempt = Number.isSafeInteger(meta[ATTEMPTS]?.[sid]) ? meta[ATTEMPTS][sid] : 0;
    const seed = fightSeed(sid, attempt);
    const pending = object(meta[START]) && meta[START].anchor === sid ? meta[START] : null;
    const opened = Array.isArray(pending?.result?.opened) && pending.result.opened.length ? structuredClone(pending.result.opened) : null;
    // A fight against the foes a fled or lost fight left starts from that fight's exact bars (resume.js), if the Foes block still reads what the board left.
    const resumed = resumeMembers(records, groups, sheet.foes);
    const session = { id: `${sid}:${attempt}`, origin: sid, anchor: sid, groups, ...(resumed ? { resumed: true } : {}),
        // (`bars: 2`: the fight's rule mark for the doubled bars, set only when every character on the sheet has them; a mixed or older party plays as before; `soak: 1` goes with it: VIT soak, soak.js)
        setup: { seed, offset: 0, rules: structuredClone(rules), members: 1, aoe: 1, areaAll: 1, foesSix: 1, foesClear: 1, fightLen: 1, ...(hardFoes(sheet) ? { foesHard: 1 } : {}), ...(doubled(sheet) ? { bars: 2, soak: 1 } : {}), ...(resumed ? { carriedMembers: resumed } : {}), ...(opened ? { opened } : {}),
            flags: boardFlags(state), weapons: structuredClone(weapons), ...(gear ? { gear: structuredClone(gear) } : {}) }, exchanges: [] };
    const preview = playBoard(state, session.setup, []);
    if (preview.error) return preview;
    meta[KEY] = session;
    return { session, preview };
}

/** Try an exchange without writing the sheet; rejected choices do not enter the session. */
export function stageExchange(meta, state, actions) {
    const session = boardSession(meta);
    if (!session) return { error: 'Open a fight first.' };
    if (session.exchanges.length && session.setup.witness?.offset !== session.setup.offset) return { error: 'This fight cannot be checked. Discard it (Fight tab, Discard fight) and start the fight again.' };
    const exchanges = [...session.exchanges, { actions: structuredClone(actions) }];
    const setup = { ...session.setup, witness: session.setup.witness ?? { offset: session.setup.offset, hash: boardWitness(state, session.setup) } };
    const preview = playBoard(state, setup, exchanges);
    if (preview.error) return preview;
    session.setup = setup;
    session.exchanges = exchanges;
    return { session, preview };
}

/** Discard changes the next opening's seed; no staged rolls were written to the sheet. */
export function discardBoard(meta) {
    const session = boardSession(meta);
    if (!session) return false;
    if (!object(meta[ATTEMPTS])) meta[ATTEMPTS] = {};
    meta[ATTEMPTS][session.origin] = (Number.isSafeInteger(meta[ATTEMPTS][session.origin]) ? meta[ATTEMPTS][session.origin] : 0) + 1;
    delete meta[SEND];
    delete meta[KEY];
    return true;
}
