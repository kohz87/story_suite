// Auto's "badly hurt" rule on a Combat Rules v1 record: a hero who lost two fifths or more of their maximum HP in the last exchange (the old rule's 2 of 5 blocks), read from that exchange's foe-attack lines.
const SHARE = 0.4;

/** The names of the heroes the last exchange hurt that badly, in party order. */
export function hurtHeroesV1(record) {
    const lines = record?.rounds?.at(-1) ?? [], lost = new Map();
    for (const line of lines) if (Array.isArray(line) && line[0] === 'foe-attack') lost.set(line[2], (lost.get(line[2]) ?? 0) + (Number(line[9]) || 0));
    return (record?.party ?? []).filter(hero => Number(hero.maxHp) > 0 && (lost.get(hero.label) ?? 0) >= SHARE * Number(hero.maxHp)).map(hero => String(hero.label));
}
