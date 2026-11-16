// The old engine's rounds as the Fight view's log rows (FIGHT_SHAPE `log`) and its turn order as names. Pure; the same facts as note.js `labelLine`, split into the four cells.
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const signed = n => (n >= 0 ? `+${n}` : String(n));
const plural = name => (!name ? '' : /s$/iu.test(name) ? name : `${name}s`);
const bonusOf = pc => (pc.statBonus ?? 0) + (pc.classBonus ?? 0) + (pc.rank ?? 0) + (pc.edge ?? 0);

function rowOf(line) {
    const pc = isRecord(line.pc) ? line.pc : {}, foe = isRecord(line.foe) ? line.foe : {};
    if (line.item) return { who: text(pc.who), what: `Uses ${text(line.item)}`, outcome: 'ITEM', math: text(line.target) ? `on ${text(line.target)}` : '' };
    const skill = line.skill ? text(line.skill) : 'Attack';
    if (line.flee) return { who: text(pc.who), what: 'Flees', outcome: String(line.outcome ?? '').toUpperCase(), math: '' };
    if (line.support) return { who: text(pc.who), what: `${skill} → ${text(line.target)}`, outcome: String(line.outcome ?? '').toUpperCase(), math: '' };
    const outcome = line.kind === 'foe' && Number.isInteger(line.soaked) && line.soaked >= 0 ? 'GLANCED OFF' : String(line.outcome ?? '').toUpperCase();
    const tag = line.decisive ? `${outcome} · DECISIVE` : outcome;
    if (line.kind === 'foe') {
        const math = Number.isFinite(foe.total) && Number.isFinite(foe.die)
            ? `${text(foe.name)} d20 ${foe.die} ${signed(foe.total - foe.die)} = ${foe.total} vs ${text(pc.who)}’s defence d20 ${pc.die} ${signed(bonusOf(pc))} = ${pc.total}` : '';
        return { who: `${text(foe.name)} → ${text(pc.who)}`, what: skill === 'Attack' ? 'Attacks' : skill, outcome: tag, math };
    }
    const math = Number.isFinite(pc.die) ? `d20 ${pc.die} ${signed(bonusOf(pc))} = ${pc.total} vs ${foe.total ?? line.dc ?? '?'}` : '';
    return { who: `${text(pc.who)} → ${text(foe.name)}`, what: skill, outcome: tag, math };
}

/** `log` for FIGHT_SHAPE from the old record's rounds. */
export const logOfOld = rounds => (Array.isArray(rounds) ? rounds : []).map(round => ({ n: Math.max(0, Math.trunc(Number(round.n)) || 0), summary: `${(round.lines ?? []).length} rolls${round.decisive ? ' · decisive' : ''}`, rows: (round.lines ?? []).filter(isRecord).map(rowOf) }));

/** Turn order names: party entries as they are, a split group once under its plural name. */
export function orderOfOld(order, members) {
    const seen = new Set(), out = [];
    for (const item of Array.isArray(order) ? order : []) {
        if (!isRecord(item)) continue;
        const slot = Number(item.slot ?? String(item.id ?? '').replace(/^f:/u, ''));
        const member = item.party ? null : (Array.isArray(members) ? members : []).find(entry => Number(entry?.slot) === slot);
        if (member && Number.isInteger(member.group) && member.group !== slot) {
            if (seen.has(member.group)) continue;
            seen.add(member.group);
            out.push(plural(text(member.name).replace(/ pack \d+$/u, '').replace(/ \d+$/u, '')));
        } else if (text(item.name)) out.push(text(item.name));
    }
    return out;
}
