// Auto-fight's stop rule on a Combat Rules v1 record: won or lost first, then a hero badly hurt, then the cap.
// A hero is badly hurt when the last exchange took two fifths or more of their maximum HP, read from that exchange's foe-attack lines.
const SHARE = 0.4;

/** The names of the heroes the last exchange hurt that badly, in party order. */
export function hurtHeroes(record) {
    const lines = record?.rounds?.at(-1) ?? [], lost = new Map();
    for (const line of lines) if (Array.isArray(line) && line[0] === 'foe-attack') lost.set(line[2], (lost.get(line[2]) ?? 0) + (Number(line[9]) || 0));
    return (record?.party ?? []).filter(hero => Number(hero.maxHp) > 0 && (lost.get(hero.label) ?? 0) >= SHARE * Number(hero.maxHp)).map(hero => String(hero.label));
}

/**
 * After an exchange: `won`/`lost` first, then `hurt`, then `cap` once `done` exchanges have run. `done` may be a count or a list of exchanges. Otherwise null.
 */
export function autoStop(result, { cap, done } = {}) {
    if (result?.stop === 'won') return 'won';
    if (result?.stop === 'lost') return 'lost';
    if (hurtHeroes(result).length > 0) return 'hurt';
    const completed = Array.isArray(done) ? done.length : Number.isFinite(Number(done)) ? Number(done)
        : Array.isArray(result?.rounds) ? result.rounds.length : 0;
    return Number.isFinite(Number(cap)) && Number(cap) > 0 && completed >= Number(cap) ? 'cap' : null;
}
