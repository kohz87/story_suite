// `edge: +1 (reason)`: the narrator moves a roll's difficulty at most two steps, and says why.

const READ = /^([+\-−–]?)\s*(\d+)\s*(?:\(([^)]*)\)?|(.*))?$/su;

/**
 * Reads an edge label. → null when there is none, else `{ steps, why, ignored }`: `steps` is the move in the roller's favour (+1 makes the roll one step
 * easier, −2 two steps harder; at most 2 either way), `why` the reason. An edge with no reason, or one that is not a number, is ignored (`steps` 0).
 */
export function readEdge(text) {
    const raw = typeof text === 'string' ? text.trim() : '';
    if (!raw) return null;
    const found = READ.exec(raw);
    const why = (found?.[3] ?? found?.[4] ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!found || !why) return { steps: 0, why: '', ignored: true };
    const size = Math.min(2, Number(found[2]));
    return { steps: found[1] === '+' || found[1] === '' ? size : -size, why, ignored: false };
}
