// The v1 fight record's rounds as the Fight view's log (FIGHT_SHAPE `log`): one row per roll, in the four cells the cards draw. Pure: it reads the record only.
const up = value => String(value ?? '').toUpperCase().replace(/-/gu, ' ');
const signed = n => (n >= 0 ? `+${n}` : String(n));

// Each line tuple is the engine's own (combat/record.js `lineOf`); the lines with no roll (init, order, exchange, stance, foe-phase) have no row.
const ROWS = {
    attack: ([who, how, target, die, total, foeDie, against, outcome, damage], names) => ({ who: `${who} → ${target}`, what: names(who, how), outcome: up(outcome), math: foeDie === null ? `d20 ${die} = ${total}` : `d20 ${die} = ${total} vs d20 ${foeDie} = ${against}${damage ? ` · ${damage} damage` : ''}` }),
    heal: ([who, target, amount, after]) => ({ who: `${who} → ${target}`, what: 'Heal', outcome: 'HEAL', math: `${signed(amount)} · HP ${after}` }),
    flee: ([who, target, die, mine, foeDie, theirs, ok]) => ({ who, what: 'Flees', outcome: ok ? 'SUCCESS' : 'FAILS', math: `d20 ${die} = ${mine} vs ${target} d20 ${foeDie} = ${theirs}` }),
    tempo: ([who, target, die, mine, foeDie, theirs, won]) => ({ who, what: 'Tempo', outcome: won ? 'ACTS AGAIN' : 'FAILS', math: `d20 ${die} = ${mine} vs ${target} d20 ${foeDie} = ${theirs}` }),
    'foe-attack': ([foe, hero, die, attack, evasionDie, evasion, outcome, soak, damage]) => ({ who: `${foe} → ${hero}`, what: 'Attacks', outcome: up(outcome), math: `d20 ${die} = ${attack} vs evasion d20 ${evasionDie} = ${evasion}${outcome === 'evaded' ? '' : ` · ${damage} damage after ${soak}% soak`}` }),
};

/** `log` for FIGHT_SHAPE from the record: `{ n, summary, rows }` per exchange (`n` counts on from the exchanges played before this segment). `party` names the skills ('Attack' for the normal attack). */
export function logOfV1(record) {
    const rounds = Array.isArray(record?.rounds) ? record.rounds : [], first = Math.max(0, (Number(record?.exchanges) || 0) - rounds.length);
    const skill = (who, type) => record.party?.find(hero => hero.label === who)?.skills?.find(entry => entry.type === type)?.name ?? '';
    const names = (who, how) => (how === 'area' ? skill(who, 'area') || 'Area attack' : how === 'skill' ? skill(who, 'attack') || 'Attack' : 'Attack');
    return rounds.map((lines, at) => {
        const rows = lines.filter(line => Array.isArray(line) && ROWS[line[0]]).map(line => ROWS[line[0]](line.slice(1), names));
        const decisive = rows.some(row => row.outcome === 'DECISIVE');
        return { n: first + at + 1, summary: `${rows.length} rolls${decisive ? ' · decisive' : ''}`, rows };
    });
}
