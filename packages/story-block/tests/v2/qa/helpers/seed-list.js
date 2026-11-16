// QA helper: the seeds of a QA_REREAD_SEEDS list (the edit-then-Re-read shards), one reader for both.
// Not a test file (the test glob does not match helpers/).

/** `a-b` ranges and single numbers, comma-separated (`3,9,12`, `1-100`); anything else throws. */
export function seedList(text) {
    return text.split(',').flatMap(part => {
        const found = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
        if (!found) throw new Error(`QA_REREAD_SEEDS: "${part}" is not a seed or a range (use 7, 3,9,12 or 1-100)`);
        const [from, to] = [Number(found[1]), Number(found[2] ?? found[1])];
        if (to < from) throw new Error(`QA_REREAD_SEEDS: the range "${part}" runs backwards`);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    });
}
