// The horde parts of the v1 Fight view, pure: which foes a slot shows (its latest wave while the fight is open; the fallen of earlier waves only count as down) and the
// "still coming" strip (FIGHT_SHAPE `horde`): "Wave 2 · 8 still coming", "Hold 4 more exchanges · or until Ghoul Warlord falls", and how many are down so far.
const parts = foe => String(foe.id).split('.');
const waveOf = foe => (parts(foe).length > 2 ? Number(parts(foe)[1]) : 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The record's foes a board shows: every foe when the fight is not a horde or has ended, else each slot's latest wave only. */
export function shownFoes(record, horde, ended) {
    if (!horde || ended) return record.foes;
    const latest = new Map();
    for (const foe of record.foes) latest.set(parts(foe)[0], Math.max(latest.get(parts(foe)[0]) ?? 0, waveOf(foe)));
    return record.foes.filter(foe => waveOf(foe) === latest.get(parts(foe)[0]));
}

/** `{ wave, until, down }` for an open horde (`setup.horde`, the record's `horde` state), or null. `leaderName` names a front leader's slot (the sheet's group name). */
export function hordeStrip(setup, record, leaderName = null) {
    const horde = setup?.horde, state = record?.horde;
    if (!horde || !state || record.result !== 'unfinished') return null;
    const coming = horde.reserve.slice(state.next).reduce((sum, group) => sum + group.count, 0), wave = state.wave + 1;
    const leader = horde.leaderSlot === undefined ? horde.reserve.find(group => group.leader)?.name ?? null : leaderName;
    const left = horde.hold ? Math.max(1, horde.hold - (Number(record.exchanges) || 0)) : 0;
    const until = [left ? `Hold ${plural(left, 'more exchange')}` : '', leader ? `${left ? 'or until' : 'Until'} ${leader} falls` : ''].filter(Boolean).join(' · ') || 'Until none are left';
    return { wave: `Wave ${wave} · ${coming ? `${coming} still coming` : 'the last of them'}`, until, down: record.foes.filter(foe => !(Number(foe.hp) > 0)).length };
}
