// Reading and tidying the fishing sessions: the party's stack a grant made, pruning old lines, the open line.
import { SESSION_KEEP } from './constants.js';

// The stack the grant made or topped up. SPEC §7 does not say what inventory.grant returns, so try, in
// order: a stack id in its result, a party stack stamped with this receipt (`from`), a party stack of
// the def its alias names.
export function stackOf(ctx, result, name, hint = {}) {
    const inv = ctx.read('inventory') ?? {};
    const stacks = inv.stacks ?? {};
    const live = s => s && s.owner === 'party' && Number.isInteger(s.qty) && s.qty > 0;
    const fromResult = [result?.data?.stack, result?.stack, result?.data?.stackId].find(v => typeof v === 'string');
    const ids = [fromResult, hint.stack].filter(Boolean);
    for (const id of ids) if (live(stacks[id])) return stacks[id];
    const all = Object.values(stacks);
    if (hint.receipt) {
        const stamped = all.find(s => live(s) && s.from === hint.receipt);
        if (stamped) return stamped;
    }
    const defId = hint.def ?? inv.aliases?.[name.toLowerCase()] ?? null;
    return (defId && all.find(s => live(s) && s.def === defId)) || null;
}

export function prune(fishing) {
    const closed = Object.values(fishing.sessions).filter(s => s.status !== 'waiting').sort((a, b) => b.n - a.n);
    for (const s of closed.slice(SESSION_KEEP)) delete fishing.sessions[s.id];
}

export const waitingOf = fishing => Object.values(fishing.sessions).find(s => s.status === 'waiting') ?? null;
