// Shared PRNG, line generators, cast/clock helpers and validators for fuzz-delete-seeds.test.js.
import { PRESETS, makeCalendar } from '../../../src/calendar.js';

// mulberry32: the fuzz's only randomness.
export function prng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
    next.pick = list => list[Math.floor(next() * list.length)];
    next.chance = p => next() < p;
    return next;
}

// Record IDs come from crypto: seeded for the run, so a failure replays with its seed.
export function seedCrypto(seed) {
    const crypto = globalThis.crypto;
    const random = prng(seed ^ 0x9E3779B9);
    const own = { values: Object.hasOwn(crypto, 'getRandomValues'), uuid: Object.hasOwn(crypto, 'randomUUID') };
    const old = { values: crypto.getRandomValues, uuid: crypto.randomUUID };
    crypto.getRandomValues = array => {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(random() * 256);
        return array;
    };
    crypto.randomUUID = () => {
        const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16)).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
    };
    return () => {
        if (own.values) crypto.getRandomValues = old.values; else delete crypto.getRandomValues;
        if (own.uuid) crypto.randomUUID = old.uuid; else delete crypto.randomUUID;
    };
}

export const BASE = ['Base Hook', 'Base Rumour'];
export const BASE_PLACES = ['Bluewatch', 'Ridge Fort'];
// World events the first reply opens: more than three stay open, so a world pick (chronicle.surface, on
// the carrier before each reply) runs before nearly every reply, and later replies move them on.
export const BASE_WORLD = ['Salt Riots', 'Hill Rains', 'Wolf Winter', 'River Levy', 'Grain Fever', 'Pass Bandits'];
export const THREAD_KINDS = ['hook', 'agenda', 'event', 'beat', 'secret'];
export const STATES = ['looming', 'ongoing', 'resolved'];
const FUNNY = ['Ro​pe', '‮Rope', 'Rópe', '__proto__', 'constructor', 'x'.repeat(130)];

const SYLLABLES = ['ka', 'vo', 'ru', 'mi', 'te', 'sa', 'lo', 'fen', 'dar', 'qui', 'zo', 'bel', 'nor', 'ith', 'wy', 'gra'];
export const word = r => {
    const text = Array.from({ length: 3 }, () => r.pick(SYLLABLES)).join('');
    return text[0].toUpperCase() + text.slice(1);
};

// One reply's lines: new things under names of its own, then changes to its own or the first reply's.
export function replyLines(r, n) {
    const own = [];
    const quests = [];
    const lines = [];
    // One made-up word per name, all of one length: no name reads as near another (v1's near keys
    // match shared words and a word inside another), so a line never reaches another reply's thread.
    let made = 0;
    const name = () => `${word(r)}${String(n).padStart(2, '0')}${String((made += 1)).padStart(2, '0')}`;
    for (let i = r.int(1, 6); i > 0; i -= 1) {
        const roll = r();
        if (roll < 0.35) {
            const key = name();
            own.push(key);
            lines.push(`+ ${r.pick(THREAD_KINDS)} ${key} — something${r.chance(0.3) ? ` | giver: ${r.pick(['Fenna', 'Brom'])}` : ''}`);
        } else if (roll < 0.5) {
            const key = name();
            own.push(key);
            // Often only mentioned first (a hook with its giver and pay), then accepted in the same reply:
            // the + quest makes the hook the quest, active and taken on at once.
            if (r.chance(0.4)) lines.push(`+ hook ${key} — a job on offer | giver: Fenna | reward: ${r.int(1, 30)} gold`);
            // Now and then in a coin word the chat cannot count until the Coins are set (COINS_AT): the turn-in
            // leaves it owed (quest.payOwed pays it once the coins count it, in a later reply).
            const pay = r.chance(0.35) ? `${r.int(1, 30)} copper bits` : `${r.int(1, 30)} gold`;
            lines.push(`+ quest ${key} — a job | giver: Fenna | goal: Find the ${key} | reward: ${pay}${r.chance(0.7) ? ` | due: June ${r.int(3, 7)}, 1200` : ''}`);
            quests.push(key);
        } else if (roll < 0.62) {
            const from = r.chance(0.5) ? r.pick(BASE_PLACES) : name();
            lines.push(r.chance(0.5) ? `+ route ${from} — ${name()} | hours: ${r.int(1, 9)} | kind: ${r.pick(['road', 'trail'])}` : `+ landmark ${name()} | region: Vale | kind: ${r.pick(['town', 'ruin'])}`);
        } else if (roll < 0.72) {
            const key = name();
            lines.push(`+ world ${key} — afoot | state: ${r.pick(STATES)}`);
            if (r.chance(0.4)) lines.push(`~ world ${key} | state: ${r.pick(STATES)}`);
        } else if (roll < 0.76) {
            // A world line on one of the first reply's events: resolved or moved on (it writes the pick's
            // rounds by key only, so a deleted pick before it never makes it fail).
            lines.push(r.chance(0.5) ? `- world ${r.pick(BASE_WORLD)} — it ends` : `~ world ${r.pick(BASE_WORLD)} | state: ${r.pick(['looming', 'ongoing'])}`);
        } else if (roll < 0.84) {
            lines.push(r.chance(0.6) ? `! time +${r.int(1, 30)}h` : r.chance(0.5) ? `! time +${r.int(2, 4)}d` : SET_LINE);
        } else if (roll < 0.92) {
            lines.push(r.pick([`? hook ${name()} — who`, '+ hook', `? hook ${r.pick(FUNNY)} — odd`, `~ quest ${name()} | met: yes`]));
        } else {
            lines.push(`~ hook ${r.pick(BASE)} | now: ${name()}`);
        }
    }
    // A quest turned in on the story's word, the giver arriving after the turn-in line (or not at all): it
    // waits for where the reply ends up, and is paid or refused by a later Director line or the step
    // before the next reply (quest.settle). Or written as a line that does not close it ("Fenna pays you"),
    // which the afterCapture step turns in from where things stand; and the story's own `+ coin` for it now
    // and then, before or after, counted as the reward or taken back (never paid twice).
    if (quests.length && r.chance(0.4)) {
        const key = r.pick(quests);
        lines.push(`~ quest ${key} | met: yes`, r.chance(0.7) ? `- quest ${key} — turned in` : `~ quest ${key} — Fenna pays you`);
        if (r.chance(0.6)) lines.push(r.chance(0.5) ? '+ present Fenna' : `~ place ${r.pick(BASE_PLACES)} | kind: town`);
        if (r.chance(0.5)) lines.push(`! time +${r.int(1, 3)}h`);
        if (r.chance(0.3)) lines.push(`+ coin ${r.int(1, 20)}`);
    }
    for (const key of own) {
        if (r.chance(0.3)) lines.push(`~ hook ${key} | now: nearby`);
        if (r.chance(0.2)) lines.push(`- hook ${key} — it passed`);
    }
    return lines;
}

// Near-name quest lines (own stream, so the story's lines stay as they were): a hook, the quest taken on from it under a
// name that only reads near it, and a closing or progress line under a third near spelling ("Cellar-Rat Cull"), all of the
// reply's own. The hook stays live beside the quest, so the line finds two near matches and the quest line's kind settles it.
export const NEAR = { hook: 'Rats', quest: 'Cellar-Rats', line: 'Cellar-Rat Cull' };
export const TIE = { hook: 'Hunt South', quest: 'Hunt North', line: 'Hunt' };
export function nearLines(rn, n) {
    if (!rn.chance(0.4)) return { lines: [] };
    const base = `${word(rn)}${String(n).padStart(2, '0')}77`;
    // (stage73) Now and then a tie: a quest and a hook that match the line equally well ("Hunt North" / "Hunt South" for "Hunt"):
    // the line must stay unclear, both records as they were.
    if (rn.chance(0.3)) {
        return { base, tie: true, lines: [`+ hook ${base} ${TIE.hook} — wolves on the ridge | giver: Fenna | reward: 5 gold`,
            `+ quest ${base} ${TIE.quest} — a job | giver: Fenna | reward: 6 copper | step: Find the trail`, `- quest ${base} ${TIE.line} — done`] };
    }
    const close = rn.chance(0.6);
    const lines = [`+ hook ${base} ${NEAR.hook} — rats under the store | giver: Fenna | reward: 5 gold`,
        `+ quest ${base} ${NEAR.quest} — a job | giver: Fenna | reward: 6 copper | step: Find the key`,
        close ? `- quest ${base} ${NEAR.line} — turned in` : `~ quest ${base} ${NEAR.line} | step: Seal the burrow`];
    return { lines, base, close };
}

export const BASE_OFFERS = ['Wharf Haul', 'Mill Repair'];

// A reply's trip lines (own stream): routes from both of the first reply's places to a waypoint of the reply's own (so there is a way to go from
// wherever the scene is; routes of the reply's own, as the other lines' routes are, so a delete never takes what a later route line changes), then a
// trip, a delay or a stop. The scene starts at Bluewatch (the first reply). Reply 4 always sets out, so every seed has a trip to delete around.
export function tripLines(rt, n) {
    const forced = n === 4;
    if (!forced && !rt.chance(0.35)) return [];
    const roll = forced ? 0 : rt();
    if (roll < 0.5) {
        const stop = `Wayside${n}`;
        return [`+ route ${BASE_PLACES[0]} — ${stop} | hours: ${rt.int(6, 40)} | kind: road`, `+ route ${BASE_PLACES[1]} — ${stop} | hours: ${rt.int(6, 40)} | kind: road`,
            `~ trip ${stop} | by: ${rt.pick(['foot', 'riding', 'wagon'])}${rt.chance(0.25) ? ` | via: ${BASE_PLACES[0]}` : ''}`,
            ...(forced || rt.chance(0.5) ? [`~ trip delay: ${rt.int(1, 3)} hours`] : [])];
    }
    if (roll < 0.8) return [`~ trip delay: ${rt.int(1, 20)} ${rt.pick(['hours', 'days'])}${rt.chance(0.5) ? ' | because: a lame horse' : ''}`];
    return ['~ trip stop'];
}

// Key people (own stream): the first reply's people are pinned by the reader after it (so on a reply never deleted); later the reader pins and
// unpins now and then (on whatever reply is the latest, which a delete may take), and the replies' lines send people away, add steps, change
// their plans, bring them back, and now and then record a death. A line may name someone no longer pinned (it is refused, quietly) or whose
// away record a deleted reply made (a step then has nothing to join: passed over on replay, never a failing block). A stand-in for NPC State
// Delta lists the base people and loses one now and then (archived there): the sync step takes it off the list before the next reply, and the
// tell step after that reply's lines writes its card line on the reply (a delete may take either; a swipe of the reply says it again).
export const KEY_BASE = ['Ren', 'Odda', 'Fenna'];
export function keyLines(rk, host, n) {
    const pinned = Object.values(host.head().domains.keypeople?.pins ?? {}).map(entry => entry.name);
    const pool = [...KEY_BASE, ...pinned, `Gone${n}`];
    const lines = [];
    for (let i = rk.int(0, 3); i > 0; i -= 1) {
        const who = rk.pick(pool);
        const roll = rk();
        if (roll < 0.3) lines.push(`+ away ${who} — on the road number ${n} | back: June ${rk.int(4, 28)}, 1200`);
        else if (roll < 0.5) lines.push(`! away ${who} — reached stop ${n}.${i}`);
        else if (roll < 0.65) lines.push(`~ away ${who} — held up | back: June ${rk.int(4, 28)}, 1200`);
        else if (roll < 0.85) lines.push(`- away ${who}`);
        else if (roll < 0.9) lines.push(`- key ${who} | died`);
        else lines.push(`- key ${who}`);
    }
    return lines;
}
export async function keyEdits(rk, host, n, delta) {
    if (rk.chance(0.3)) {
        const known = Object.keys(delta);
        if (known.length) delete delta[rk.pick(known)];
    }
    if (rk.chance(0.2)) delta[rk.pick([...KEY_BASE, `Key${n}`])] ??= {};
    if (rk.chance(0.25)) await host.sdk.command('keypeople.pin', { name: `Key${n}` });
    const pinned = Object.values(host.head().domains.keypeople?.pins ?? {}).map(entry => entry.name);
    if (pinned.length && rk.chance(0.12)) await host.sdk.command('keypeople.unpin', { name: rk.pick(pinned) });
    if (rk.chance(0.1)) await host.sdk.command('keypeople.pin', { name: rk.pick([...KEY_BASE, `Key${n}`]) });
}

// Names (feature story-director.names, own stream): replies declare people now and then, some again (the same person), some with an overused
// name or a near spelling; the part's `names.seen` / `names.told` steps and its refusals must replay the same after a delete or a swipe.
const NAME_POOL = ['Corst', 'Hald', 'Wenna', 'Joost', 'Elara', 'Bregje', 'Bregja', 'Odda', 'Maaike'];
export const nameLines = (rn, n) => (rn.chance(0.6) ? [`+ person ${rn.chance(0.2) ? `Extra${n}` : rn.pick(NAME_POOL)} | look: scar ${n} | flaw: proud`] : []);

export const FACTIONS = ['Fuzz Guild', 'Red Hand', 'Salt Court', 'Grey Wardens'];
export const RIPPLES = { powers: [{ id: 'crown', name: 'The Crown', base: 50, aliases: ['Crown'], givers: ['Fenna'], factions: ['Red Hand'] }, { id: 'guild', name: 'Fuzz Guild', base: 40, givers: ['Brom'], factions: ['Salt Court'] }],
    worldDirections: [{ event: 'Salt Riots', favours: 'crown', unless: ['bloody'] }, { event: 'Hill Rains', favours: 'guild' }] };

export const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

// The cast (own stream): six people at the first reply's places and one elsewhere; `drawnTo` words that every reply's text holds, so the
// story "touches" them; two may die. The pack's entries and version change now and then (castEdits); the scripted planner (castAnswer) moves
// some people, brings one whose goal was touched and now and then kills one who may die.
const CAST_PLACES = [...BASE_PLACES, 'Wayside4', 'Kesh'];
export const castEntry = (id, rc, version) => ({
    pack: 'ersveil', packVersion: version, id, name: id[0].toUpperCase() + id.slice(1), about: `${id} is somebody.`, look: 'weathered',
    start: { place: rc.pick(CAST_PLACES), goal: `${id} goal`, routine: rc.pick(['', 'works the night ferry', 'at the forge in the morning', 'sells wares by day']) },
    drawnTo: rc.chance(0.4) ? ['the reply'] : [], canDieUnmet: rc.chance(0.3), fields: { Calling: callingOf(id) },
});
// A person the replies name when she passes through a scene inside one reply (like Ylva, not one of CAST_IDS).
export const wrenEntry = version => ({ pack: 'ersveil', packVersion: version, id: 'wren', name: 'Wren', about: 'Wren is somebody.', look: 'weathered', fields: { Calling: 'courier' }, start: { place: BASE_PLACES[0], goal: 'wren goal', routine: '' }, drawnTo: [] });
export const CAST_IDS = ['aino', 'borka', 'cael', 'dren', 'eska', 'fotu'];
// A calling each person can be sought by ("Is there a ferryman around?"): the reader asks for one now and then and the scripted planner names the person.
const CALLINGS = { aino: 'ferryman', borka: 'scout', cael: 'smith', dren: 'healer', eska: 'priest', fotu: 'guide' };
const callingOf = id => CALLINGS[id] ?? 'tinker';
export const SOUGHT_ASK = ['ferryman', 'scout', 'smith', 'healer', 'priest', 'guide', 'tinker', 'cartographer', 'cartographer', 'cartographer'];
// Ylva is the one the replies name when she is asked for (a meeting counts only if the reply shows the person), so a sought meeting survives.
// She is not one of CAST_IDS: the guard that no prompt names an unmet person holds for the others; a rumor must not name her either.
export const ylvaEntry = version => ({ pack: 'ersveil', packVersion: version, id: 'ylva', name: 'Ylva', about: 'Ylva is somebody.', look: 'weathered', fields: { Calling: 'cartographer' }, start: { place: BASE_PLACES[0], goal: 'ylva goal', routine: '' }, drawnTo: [] });
export function castEdits(rc, source, n) {
    if (!rc.chance(0.3)) return;
    const roll = rc();
    if (roll < 0.3) {
        source.version = `1.${n}.0`;
        source.entries = source.entries.map(entryOf => ({ ...entryOf, packVersion: source.version, ...(rc.chance(0.3) ? { name: `${entryOf.name}${n}` } : {}) }));
    } else if (roll < 0.55) source.entries.push(castEntry(`late${n}`, rc, source.version));
    else if (roll < 0.75 && source.entries.length > 2) source.entries.splice(rc.int(0, source.entries.length - 1), 1);
    else source.enabled = !source.enabled;
}
export function castAnswer(rc, rs) {
    return call => {
        // A 'sought' call: the person whose calling the reader's message names (most of the time), by the words of the message.
        if (/People who might fit/.test(call.prompt)) {
            const message = /latest message:\n([^\n]*)/.exec(call.prompt)?.[1] ?? '';
            for (const match of String(call.prompt).matchAll(/^- (\S+) \|[^\n]*calling: ([^|\n]+?) \|/gm)) {
                if (message.toLowerCase().includes(match[2].toLowerCase()) && rs.chance(0.85)) return `? cast ${match[1]} | "${match[2]}"`;
            }
            return '';
        }
        const lines = [];
        for (const match of String(call.prompt).matchAll(/^- (\S+) \| ([^|\n]+)(\|[^\n]*)?$/gm)) {
            const [, ref, , rest = ''] = match;
            if (rc.chance(0.5)) lines.push(`~ cast ${ref} | ${rc.pick(CAST_PLACES)} | doing thing ${rc.int(1, 99)}`);
            if (/drawn to/.test(rest) && /has not met/.test(rest) && rc.chance(0.5)) lines.push(`> cast ${ref} | the story reached them ${rc.int(1, 99)}`);
            if (/may die/.test(rest) && rc.chance(0.2)) lines.push(`! cast ${ref} | an accident`);
        }
        return lines.join('\n');
    };
}

// The clock the replies left say, without replaying anything: the first reply sets June 3, 08:00 am
// (`start`), `SET_LINE` sets June 9, 10:00 am, each move adds on top, held to the longest jump (30 days)
// from where its reply began, as applyTimeLine does.
const SET_LINE = '~ time June 9, 1200, 10:00 am';
const SET_AFTER = (6 * 24 + 2) * 60;
const MAX_JUMP = 30 * 24 * 60;
const GREGORIAN = makeCalendar(PRESETS.gregorian);
// A reader's edit of the clock: a date in June 1200 (day, minutes of the day), as the command takes it and as the model reads it.
export const editOf = rr => {
    const day = rr.int(1, 28);
    const minutes = rr.int(0, 1439);
    return { payload: { year: 1200, month: 6, day, minutes }, abs: GREGORIAN.toAbs({ year: 1200, month: 5, day, minutes }) };
};
export const timeOf = lines => lines.map(line => {
    if (line === SET_LINE) return { set: true };
    const move = /^! time \+(\d+)([hd])$/.exec(line);
    return move ? { move: Number(move[1]) * (move[2] === 'd' ? 1440 : 60) } : null;
}).filter(Boolean);
export function expectedClock(chat, times, start) {
    let clock = start;
    for (const message of chat) {
        const from = clock;
        for (const step of times.get(message) ?? []) {
            if (step.edit !== undefined) clock = step.edit;
            else if (step.set) clock = Math.max(clock, start + SET_AFTER); // the clockFace rule: a date before the clock is refused, the clock stays
            else clock = Math.min(clock + step.move, Math.max(clock, from + MAX_JUMP));
        }
    }
    return clock;
}

export function validatorErrors(host) {
    const state = host.head();
    const out = [];
    for (const name of Object.keys(state.domains)) {
        const validate = host.registry.validator(name);
        if (typeof validate === 'function') out.push(...(validate(state.domains[name], state) ?? []).map(error => `${name}: ${error}`));
    }
    return out;
}
