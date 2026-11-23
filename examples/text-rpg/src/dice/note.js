// Builds the narrator's note from a reply's dice, bonuses, difficulties and floor.
// Adapted from modules/rpg/cue-parts/offer.js (keep in step when that file changes).

const DEFAULT_DIFFICULTIES = Object.freeze([
    { word: 'easy', dc: 8 },
    { word: 'normal', dc: 12 },
    { word: 'hard', dc: 16 },
    { word: 'very hard', dc: 20 },
    { word: 'near impossible', dc: 24 },
]);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const signed = value => (value >= 0 ? `+${value}` : `${value}`);
const isStatLabel = label => /^[A-Z][A-Z0-9]*$/.test(label);

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
        const entries = entriesOf(row.bonuses);
        if (!entries.length) return [];
        const stats = entries.filter(([label]) => isStatLabel(label));
        const skills = entries.filter(([label]) => !isStatLabel(label));
        const bonusText = [
            stats.map(([label, bonus]) => `${label}${signed(bonus)}`).join(' '),
            skills.length ? `${stats.length ? '; ' : ''}${skills.map(([label, bonus]) => `${label}${signed(bonus)}`).join(', ')}` : '',
        ].join('');
        return [{ who: row.who.trim(), text: `${row.who.trim()}: ${bonusText}`, skills }];
    });
}

/** The reply's dice note: rules, difficulty floor, bonus table and the head the narrator reports. Empty when no dice are present. */
export function diceNote(record) {
    const { list, floor, rows, difficulties } = isObject(record) ? record : {};
    const dice = Array.isArray(list) ? list.filter(die => Number.isInteger(die) && die >= 1 && die <= 20) : [];
    if (!dice.length) return '';

    const dc = difficultiesOf(difficulties);
    const floorAt = floorOf(floor);
    const table = rowsOf(rows);
    const first = table[0];
    const example = `? try ${first?.who ?? 'Astra'} | ${first?.skills?.[0]?.[0] ?? 'Obscure'} | ${dc[1].word}`;
    const parts = [
        `Dice for this reply, in order: ${dice.join(', ')}.`,
        `Use one for each attempt that can fail (yours or a party member's): total = die + bonus, against ${dc.map(({ word, dc: value }) => `${word} ${value}`).join(', ')}.`,
        'Total at the number or over: success; 1–2 short: success at a cost; more: failure; 10 or more short or a natural 1: a bad failure; a natural 20: more than asked.',
    ];
    parts.push(`A threat raises the difficulty: a foe above you → at least ${dc[2].word}, far above → ${dc[3].word}, beyond → ${dc[4].word}.`);
    if (floorAt > 0) parts.push(`Nothing this reply is easier than ${dc[floorAt].word}.`);
    if (table.length) parts.push(`Bonus by stat or skill: ${table.map(row => row.text).join('. ')}.`);
    parts.push('The story must follow each result strictly. Tell only what happens: dice, bonuses, totals and difficulty numbers never go in the story text.');
    parts.push(`Report each: ? try Who | skill or stat | difficulty, where Who is the person rolling (the reader's character or a party member, by name), never the action; for example ${example}.`);
    return parts.join(' ');
}
