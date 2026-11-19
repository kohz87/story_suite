// The storage benchmark's synthetic module (tests/bench/load.js): a party of 4, 60 stacks and 40 Director threads with fixed IDs, and its capture rules.

export const MODULE_ID = 'bench-rpg';
export const PARTY_SIZE = 4;
export const STACKS = 60;
export const THREADS = 40;
export const CHANGES_PER_REPLY = 5;
export const UI_EVERY = 4;
export const UI_COMMANDS = 3;
// v1 kept the whole state as a text block (~3 KB) at the end of every reply.
export const V1_BLOCK_CHARS = 3000;

export const KEY = 'storySuite';
export const bytesOf = value => Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
const fixedId = (prefix, n) => `${prefix}_${n.toString(36).padStart(8, '0')}`;

// ---------- the synthetic module (RPG Battle's party + Story Director's threads) ----------

export const ACTORS = ['Ren', 'Mira', 'Tobin', 'Sael'];
const CLASSES = ['fighter', 'mage', 'rogue', 'cleric'];
const ADJECTIVES = ['Missing', 'Silent', 'Broken', 'Hidden', 'Burning', 'Last', 'Drowned', 'Golden'];
const NOUNS = ['Caravan', 'Bell', 'Oath', 'Lantern', 'Crown', 'Ferry', 'Orchard', 'Debt'];
const ITEMS = ['Healing Draught', 'Rope', 'Torch', 'Rations', 'Arrow', 'Lockpick', 'Chalk', 'Candle', 'Herb Bundle', 'Whetstone'];

export const actorId = i => fixedId('ac', i + 1);
export const threadId = i => fixedId('th', i + 1);
export const threadTitle = i => `The ${ADJECTIVES[i % 8]} ${NOUNS[Math.floor(i / 8) % 8]} ${i + 1}`;
export const itemName = i => `${ITEMS[i % ITEMS.length]} ${String.fromCharCode(65 + Math.floor(i / ITEMS.length))}`;

function initialParty() {
    const actors = {};
    for (let i = 0; i < PARTY_SIZE; i++) {
        const max = 60 + i * 6;
        actors[actorId(i)] = {
            id: actorId(i), name: ACTORS[i], cls: CLASSES[i], level: 3, xp: 900,
            hp: { cur: max, max }, mp: { cur: 20 + i, max: 20 + i }, ac: 13 + (i % 3),
            stats: { str: 14 - i, dex: 11 + i, con: 13, int: 9 + i, wis: 11, cha: 10 },
            skills: { athletics: 2, stealth: 1, arcana: i, insight: 1, perception: 2, persuasion: 0 },
            conditions: [],
            note: `${ACTORS[i]} keeps a short code-written note here, as the character sheet shows it.`,
        };
    }
    return { actors, order: Array.from({ length: PARTY_SIZE }, (_, i) => actorId(i)) };
}

function initialDirector() {
    const threads = {};
    for (let i = 0; i < THREADS; i++) {
        threads[threadId(i)] = {
            id: threadId(i), title: threadTitle(i), kind: ['quest', 'rumor', 'bond', 'threat'][i % 4],
            status: 'open', stage: 1, stages: 5, tension: 1, pinned: false,
            summary: `What is known so far about ${threadTitle(i)}: who asked, what was promised, and what went wrong on the way.`,
            next: 'The next beat the Director would like the story to reach.',
            cast: [actorId(i % PARTY_SIZE), actorId((i + 1) % PARTY_SIZE)], since: 0, updated: 0,
        };
    }
    return { time: { minutes: 8 * 60 }, threads };
}

const intProblem = (value, what) => (Number.isSafeInteger(value) && value >= 0 ? [] : [`${what} must be a whole number of at least 0.`]);

function validateParty(slice) {
    const errors = [];
    for (const actor of Object.values(slice?.actors ?? {})) {
        errors.push(...intProblem(actor.hp?.cur, `${actor.name}'s HP`));
        if (actor.hp?.cur > actor.hp?.max) errors.push(`${actor.name}'s HP is above the maximum.`);
    }
    return errors;
}

function validateDirector(slice) {
    const errors = [...intProblem(slice?.time?.minutes, 'The time')];
    for (const thread of Object.values(slice?.threads ?? {})) {
        errors.push(...intProblem(thread.stage, `${thread.title}'s stage`), ...intProblem(thread.tension, `${thread.title}'s tension`));
    }
    return errors;
}

const byName = (records, field, name, ctx, what) => {
    const found = Object.values(records).find(record => record[field] === String(name ?? '').trim());
    if (!found) ctx.fail('NOT_FOUND', `There is no ${what} called "${name}".`);
    return found;
};
const label = (line, name) => line?.labels?.[name] ?? null;
const intLabel = (ctx, line, name) => {
    const n = Number(label(line, name));
    if (!Number.isSafeInteger(n)) ctx.fail('INVALID', `"${name}" must be a whole number.`);
    return n;
};

function captureHp(ctx, line) {
    const party = ctx.draft('party');
    const actor = byName(party.actors, 'name', line.name, ctx, 'party member');
    const before = actor.hp.cur;
    actor.hp.cur = Math.max(0, Math.min(actor.hp.max, before + intLabel(ctx, line, 'delta')));
    return { summary: `${actor.name}: ${before} → ${actor.hp.cur} HP.`, data: { actor: actor.id, hp: actor.hp.cur }, narrate: false };
}

function captureThread(ctx, line) {
    const director = ctx.draft('director');
    const thread = byName(director.threads, 'title', line.name, ctx, 'thread');
    thread.stage = intLabel(ctx, line, 'stage');
    thread.tension = intLabel(ctx, line, 'tension');
    thread.updated = director.time.minutes;
    return { summary: `${thread.title} moves to stage ${thread.stage} (tension ${thread.tension}).`, data: { thread: thread.id, stage: thread.stage }, narrate: false };
}

function captureTime(ctx, line) {
    const director = ctx.draft('director');
    director.time.minutes += intLabel(ctx, line, 'minutes');
    return { summary: `The clock moves to minute ${director.time.minutes}.`, data: { minutes: director.time.minutes }, narrate: false };
}

/** The synthetic module: `party` and `director` domains, four commands (three for the UI) and three capture kinds. */
export function createBenchModule() {
    const kinds = { hp: captureHp, thread: captureThread, time: captureTime };
    return {
        id: MODULE_ID,
        name: 'Bench RPG',
        version: '2.0.0-bench',
        domains: {
            party: { initial: initialParty, validate: validateParty },
            director: { initial: initialDirector, validate: validateDirector },
        },
        commands: {
            // A system command that stocks the inventory through the core module's own grant.
            'bench.seed'(ctx) {
                for (let i = 0; i < STACKS; i++) ctx.call('inventory.grant', { name: itemName(i), qty: 3 });
                ctx.call('wallet.receive', { amount: 200, note: 'starting purse' });
                return { summary: `The party starts with ${STACKS} kinds of supplies.`, narrate: false };
            },
            // A tip the reader gives: the wallet pays through another module's action (a button
            // cannot pay on its own, as in the game a shop or a service does).
            'bench.tip'(ctx, { amount = 3, note = 'a tip' } = {}) {
                ctx.call('wallet.pay', { amount, note });
                return { summary: `The party tips ${amount}.` };
            },
            'party.heal'(ctx, { actor, amount = 5 } = {}) {
                const target = ctx.draft('party').actors[actor];
                if (!target) ctx.fail('NOT_FOUND', 'There is no such party member.');
                const before = target.hp.cur;
                target.hp.cur = Math.min(target.hp.max, before + amount);
                return { summary: `${target.name} rests: +${target.hp.cur - before} HP (now ${target.hp.cur}/${target.hp.max}).`, data: { actor, healed: target.hp.cur - before } };
            },
            'director.pin'(ctx, { thread } = {}) {
                const target = ctx.draft('director').threads[thread];
                if (!target) ctx.fail('NOT_FOUND', 'There is no such thread.');
                target.pinned = !target.pinned;
                return { summary: `${target.title} is ${target.pinned ? 'pinned' : 'no longer pinned'}.`, data: { thread, pinned: target.pinned }, narrate: false };
            },
        },
        queries: {
            'party.actors': state => Object.values(state?.domains?.party?.actors ?? {}),
        },
        capture: {
            kinds: {
                hp: { grammar: '~ hp Name | delta: -7 (a party member\'s HP changes by that much)' },
                thread: { grammar: '~ thread Title | stage: 2 | tension: 3' },
                time: { grammar: '~ time Clock | minutes: 15 (how far the clock moves)' },
            },
            apply(ctx, line) {
                const fn = kinds[line?.kind];
                return fn ? fn(ctx, line) : ctx.fail('INVALID', `Bench RPG does not keep "${line?.kind}" lines.`);
            },
        },
        context: {
            static: () => 'Code keeps the party\'s HP and the open threads: write a change line for every HP change, every thread that moves, and the time that passes.',
            tail(view) {
                const party = view?.state?.domains?.party;
                const director = view?.state?.domains?.director;
                const lines = (party?.order ?? []).map(id => party.actors[id]).map(actor => `${actor.name}: ${actor.hp.cur}/${actor.hp.max} HP`);
                const threads = Object.values(director?.threads ?? {}).sort((a, b) => b.tension - a.tension || (a.id < b.id ? -1 : 1));
                return { lines, optional: threads.slice(0, 8).map(thread => `${thread.title}: stage ${thread.stage}/${thread.stages}`) };
            },
            budget: 300,
        },
    };
}

// ---------- the chat's text ----------
