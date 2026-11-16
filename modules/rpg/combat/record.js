// The one fight record read by the log, settled note and UI: final actors, ordered lines, bar moves and result.

const labelOf = actor => String(actor?.label ?? actor?.name ?? actor?.id ?? '');
const publicActor = actor => ({
    id: String(actor?.id ?? labelOf(actor)), label: labelOf(actor), level: Number(actor?.level ?? actor?.lv ?? 1),
    stats: { ...(actor?.stats ?? {}) }, hp: Number(actor?.hp ?? 0), maxHp: Number(actor?.maxHp ?? actor?.maxhp ?? 0),
    mp: Number(actor?.mp ?? 0), maxMp: Number(actor?.maxMp ?? actor?.maxmp ?? 0),
    sp: Number(actor?.sp ?? 0), maxSp: Number(actor?.maxSp ?? actor?.maxsp ?? 0),
    mastery: Number(actor?.mastery ?? 0), stances: [...(actor?.stances ?? [])], stance: actor?.stance ?? null,
    // (what a carried fight needs to go on from this record: a hero's skills, a foe's tier and its own damage and roll)
    ...(actor?.skills?.length ? { skills: actor.skills.map(skill => ({ ...skill })) } : {}),
    ...(typeof actor?.tier === 'string' ? { tier: actor.tier, damage: Number(actor.damage ?? 0), roll: Number(actor.roll ?? 0) } : {}),
});

/** Normalise a finished engine run into the record shape. The result is 'win', 'loss', 'fled' or 'unfinished'. */
export function resultOf(run = {}) {
    return {
        result: run.result ?? 'unfinished', exchanges: Number(run.exchanges ?? 0), rotation: Number(run.rotation ?? 0),
        order: { party: [...(run.order?.party ?? [])], foes: [...(run.order?.foes ?? [])], first: run.order?.first ?? 'party' },
        party: (run.party ?? []).map(publicActor), foes: (run.foes ?? []).map(publicActor),
        lines: [...(run.lines ?? [])], rounds: (run.rounds ?? []).map(lines => [...lines]), moves: [...(run.moves ?? [])],
    };
}

const arrow = (before, after) => (before === undefined || before === null ? `${after}` : `${before} → ${after}`);

// The rows keep the simulator's shape (amount before clamping, HP after), so the real "before" HP comes from the bar move.
// Positions in the row: the target's label and the HP after.
const HP_ROW = { attack: [3, 10], heal: [2, 4], 'foe-attack': [2, 10] };

/** The HP each row started from: the target's next unused HP move when it ends on the row's HP after, else unchanged. */
export function hpBefores(lines, moves) {
    const queues = new Map();
    for (const move of moves) if (move?.bar === 'hp') queues.set(move.label, [...(queues.get(move.label) ?? []), move]);
    return lines.map(line => {
        const at = Array.isArray(line) ? HP_ROW[line[0]] : null;
        if (!at) return undefined;
        const queue = queues.get(line[at[0]]) ?? [], after = line[at[1]];
        if (queue[0]?.to !== after) return after;
        return queue.shift().from;
    });
}

/** Plain text for every row of a record, with the true HP before each hit or heal (overkill and capped heals included). */
export function lineTexts(lines = [], moves = []) {
    const before = hpBefores(lines, moves);
    return lines.map((line, index) => lineOf(line, before[index]));
}

/** Render one structured line from the fight record as plain text. `before` is the HP before a hit or heal when known. */
export function lineOf(line, before) {
    if (!Array.isArray(line)) return String(line ?? '');
    const [kind, ...rest] = line;
    if (kind === 'init') {
        const [who, die, total] = rest;
        return `${who} initiative: ${die} (${total}).`;
    }
    if (kind === 'order') {
        const [party, foes, first] = rest;
        return `Order: ${party.join(', ')} before ${foes.join(', ')}; ${first === 'party' ? 'the party' : 'the foes'} act first.`;
    }
    if (kind === 'exchange') return `Exchange ${rest[0]}.`;
    if (kind === 'stance') {
        const [who, active] = rest;
        return `${who} stance: ${active.length ? active.join(', ') : 'none'}.`;
    }
    if (kind === 'attack') {
        const [who, how, target, die, total, foeDie, defence, outcome, damage, hpAfter] = rest;
        if (outcome === 'miss-nat1') return `${who} attacks ${target} (${how}): miss (natural 1); ${target} HP ${hpAfter}.`;
        if (outcome === 'miss') return `${who} attacks ${target} (${how}): miss; ${target} HP ${hpAfter}.`;
        return `${who} attacks ${target} (${how}): ${outcome}, ${damage} damage; ${target} HP ${arrow(before, hpAfter)}.`;
    }
    if (kind === 'tempo') {
        const [who, target, , mine, , theirs, won] = rest;
        return won ? `${who} acts again (tempo).` : `${who}'s tempo fails against ${target} (${mine} vs ${theirs}).`;
    }
    if (kind === 'heal') {
        const [who, target, amount, hpAfter] = rest;
        return `${who} heals ${target}: ${amount}; ${target} HP ${arrow(before, hpAfter)}.`;
    }
    if (kind === 'flee') {
        const [who, target, , , , , succeeded] = rest;
        return succeeded ? `${who} flees from ${target}.` : `${who}'s flee from ${target} fails.`;
    }
    if (kind === 'foe-phase') return `Foes attack: ${rest[0].join(', ')}.`;
    if (kind === 'foe-attack') {
        const [foe, target, , , , , outcome, soak, damage, hpAfter] = rest;
        if (outcome === 'evaded') return `${foe} attacks ${target}: evaded; ${target} HP ${hpAfter}.`;
        return `${foe} attacks ${target}: ${outcome}, ${damage} damage after ${soak}% soak; ${target} HP ${arrow(before, hpAfter)}.`;
    }
    return rest.join(' ');
}
