// Whether a stored block holds only people writes (leaf changes under /domains/people, plus the revision counter). A Re-read skips such a block
// when it no longer applies (an earlier reply that made the person was deleted), as the rebuild does, instead of refusing the whole Re-read.

const PEOPLE = /^\/domains\/people(\/|$)/;

/** `ops` → true when every change is under /domains/people or is /meta/rev, and at least one is under people. */
export function isPeopleBlock(ops) {
    if (!Array.isArray(ops) || !ops.length) return false;
    let people = false;
    for (const op of ops) {
        const path = String(op?.path ?? '');
        if (PEOPLE.test(path)) people = true;
        else if (path !== '/meta/rev') return false;
    }
    return people;
}
