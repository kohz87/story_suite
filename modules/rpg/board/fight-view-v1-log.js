// The v1 fight record's rounds as the Fight view's log (FIGHT_SHAPE `log`): one row per roll, in the four cells the cards draw. Pure: it reads the record only.
const up = value => String(value ?? '').toUpperCase().replace(/-/gu, ' ');
const signed = n => (n >= 0 ? `+${n}` : String(n));

// Each line tuple is the engine's own (combat/record.js `lineOf`); the lines with no roll (init, order, exchange, stance, foe-phase) have no row; a horde's arrival has one.
const ROWS = {
    attack: ([who, how, target, die, total, foeDie, against, outcome, damage], names) => ({ who: `${who} → ${target}`, what: names(who, how), outcome: up(outcome), math: foeDie === null ? `d20 ${die} = ${total}` : `d20 ${die} = ${total} vs d20 ${foeDie} = ${against}${damage ? ` · ${damage} damage` : ''}` }),
    heal: ([who, target, amount, after]) => ({ who: `${who} → ${target}`, what: 'Heal', outcome: 'HEAL', math: `${signed(amount)} · HP ${after}` }),
    flee: ([who, target, die, mine, foeDie, theirs, ok], names, agi) => ({ who, what: 'Flees', outcome: ok ? 'SUCCESS' : 'FAILS', math: `d20 ${die} = ${mine} vs ${target} d20 ${foeDie} = ${theirs}${agi(who)}` }),
    tempo: ([who, target, die, mine, foeDie, theirs, won], names, agi) => ({ who, what: 'Tempo', outcome: won ? 'ACTS AGAIN' : 'FAILS', math: `d20 ${die} = ${mine} vs ${target} d20 ${foeDie} = ${theirs}${agi(who)}` }),
    // (a horde's arrival: no roll, one row saying who came and how many still come)
    arrive: ([wave, slot, name, count, level, , left]) => ({ who: `${count} ${name}`, what: 'Reinforcements', outcome: `WAVE ${wave + 1}`, math: `level ${level} · slot ${slot}${left > 0 ? ` · ${left} still coming` : ' · the last of them'}` }),
    'foe-attack': ([foe, hero, die, attack, evasionDie, evasion, outcome, soak, damage], names, agi) => ({ who: `${foe} → ${hero}`, what: 'Attacks', outcome: up(outcome), math: `d20 ${die} = ${attack} vs evasion d20 ${evasionDie} = ${evasion}${agi(hero)}${outcome === 'evaded' ? '' : ` · ${damage} damage after ${soak}% soak`}` }),
};

/** `log` for FIGHT_SHAPE from the record: `{ n, summary, rows }` per exchange (`n` counts on from the exchanges played before this segment). `party` names the skills ('Attack' for the normal attack).
 * `showStats` (a fight made with the gear mark): the AGI the hero rolled with, gear counted, follows the evasion, tempo and flee rolls ("· AGI 16"). */
export function logOfV1(record, showStats = false) {
    const rounds = Array.isArray(record?.rounds) ? record.rounds : [], first = Math.max(0, (Number(record?.exchanges) || 0) - rounds.length);
    const skill = (who, type) => record.party?.find(hero => hero.label === who)?.skills?.find(entry => entry.type === type)?.name ?? '';
    const names = (who, how) => (how === 'area' ? skill(who, 'area') || 'Area attack' : how === 'skill' ? skill(who, 'attack') || 'Attack' : 'Attack');
    const agi = who => { const value = showStats ? record.party?.find(hero => hero.label === who)?.stats?.agi : null; return Number.isFinite(value) ? ` · AGI ${value}` : ''; };
    return rounds.map((lines, at) => {
        const rows = lines.filter(line => Array.isArray(line) && ROWS[line[0]]).map(line => ROWS[line[0]](line.slice(1), names, agi));
        const decisive = rows.some(row => row.outcome === 'DECISIVE'), came = rows.filter(row => row.what === 'Reinforcements').length;
        return { n: first + at + 1, summary: `${rows.length - came} rolls${decisive ? ' · decisive' : ''}${came ? ' · reinforcements' : ''}`, rows };
    });
}
