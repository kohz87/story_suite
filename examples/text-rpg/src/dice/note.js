// Builds the narrator's note from a reply's dice, bonuses, difficulties and floor.
// Adapted from modules/rpg/cue-parts/offer.js (keep in step when that file changes).

const DEFAULT_DIFFICULTIES = Object.freeze([
    { word: 'trivial', dc: 5 },
    { word: 'easy', dc: 10 },
    { word: 'ordinary', dc: 15 },
    { word: 'hard', dc: 20 },
    { word: 'very hard', dc: 25 },
    { word: 'near impossible', dc: 30 },
]);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const signed = value => (value >= 0 ? `+${value}` : `${value}`);

function floorOf(value) {
    if (!Number.isInteger(value)) return 0;
    return Math.min(DEFAULT_DIFFICULTIES.length - 1, Math.max(0, value));
}

function difficultiesOf(value) {
    const source = Array.isArray(value) ? value : [];
    return DEFAULT_DIFFICULTIES.map((fallback, at) => {
        const row = isObject(source[at]) ? source[at] : {};
        const word = typeof row.word === 'string' && row.word.trim() ? row.word.trim() : fallback.word;
        const dc = Number.isInteger(row.dc) ? row.dc : fallback.dc;
        return { word, dc };
    });
}

function entriesOf(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(entry => Array.isArray(entry)
        && typeof entry[0] === 'string' && entry[0].trim()
        && Number.isInteger(entry[1]))
        .map(([label, bonus]) => [label.trim(), bonus]);
}

function rowsOf(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap(row => {
        if (!isObject(row) || typeof row.who !== 'string' || !row.who.trim()) return [];
        const skills = entriesOf(row.bonuses);
        if (!skills.length) return [];
        return [{ who: row.who.trim(), text: `${row.who.trim()}: ${skills.map(([label, bonus]) => `${label} ${signed(bonus)}`).join(', ')}`, skills }];
    });
}

/** The reply's dice note: rules, difficulty floor (with `why`, what raised it: the live conditions), bonus table and the head the narrator reports. Empty when no dice are present. */
export function diceNote(record) {
    const { list, floor, rows, difficulties, why } = isObject(record) ? record : {};
    const dice = Array.isArray(list) ? list.filter(die => Number.isInteger(die) && die >= 1 && die <= 20) : [];
    if (!dice.length) return '';

    const dc = difficultiesOf(difficulties);
    const floorAt = floorOf(floor);
    const table = rowsOf(rows);
    const first = table[0];
    const example = `? try ${first?.who ?? 'Astra'} | ${first?.skills?.[0]?.[0] ?? 'Obscure'} | ${dc[2].word} | threat: a fair match`;
    const parts = [
        `Dice for this reply, in order: ${dice.join(', ')}.`,
        `One per attempt that can fail, skipping a moot one: total = die + bonus, against ${dc.map(({ word, dc: value }) => `${word} ${value}`).join(', ')}.`,
        'At the number or over: success; 1–2 short: success at a cost; 3–9 short: failure; 10 or more short: a bad failure. A natural 20 or 1 changes only the telling (well done, clumsy).',
        `Threat sets the difficulty: far beneath → ${dc[0].word}, beneath → ${dc[1].word}, fair → ${dc[2].word}, above → ${dc[3].word}, far above → ${dc[4].word}, beyond → ${dc[5].word}; your word counts only with no threat; a live condition adds a step under a threat. | edge: +1 (reason) eases a step, -1 hardens, at most 2; no reason, no edge.`,
    ];
    const reasons = (Array.isArray(why) ? why : []).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
    if (floorAt > 0) parts.push(`Nothing this reply is easier than ${dc[floorAt].word}${reasons.length ? ` (${reasons.join(', ')})` : ''}.`);
    parts.push(`Bonus: skill rank × 2 (Novice +0 … Legend +12); a stat +0; a skill not on the sheet −3; −2 for each injury on its stat.${table.length ? ` ${table.map(row => row.text).join('. ')}.` : ''}`);
    parts.push('Follow each result; no numbers in the story text.');
    parts.push(`Report: ? try Who | skill or stat | difficulty | threat: … (Who = the person rolling, by name); e.g. ${example}.`);
    return parts.join(' ');
}
