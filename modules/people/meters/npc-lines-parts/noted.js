// Tells a receipt what a line stored when it moved no meter: "Ilka: nothing moved" said nothing of a tie, a taste, a place or a goal that WAS written.

const NOTE_WORD = Object.freeze({ tie: 'tie stored', taste: 'taste stored', know: 'knowledge stored', lie: 'lie stored' });
const FIELD_WORD = Object.freeze({ where: 'place', location: 'place', goal: 'goal', status: 'status', gender: 'gender', mood: 'mood', look: 'look', age: 'age', birthday: 'birthday', level: 'level', learns: 'ability', keepsake: 'keepsake' });

/** The receipt with "<name>: nothing moved" followed by what was stored; the feelings did not move, so the start of the sentence stays true (the journal still reads it as upkeep) (`what`: "tie stored", "place, goal stored"); a receipt that moved something is left as it is. */
export function noted(out, what) {
    const name = out?.data?.name;
    if (!what || !name || typeof out.summary !== 'string' || !out.summary.includes(`${name}: nothing moved`)) return out;
    return { ...out, summary: out.summary.replace(`${name}: nothing moved`, `${name}: nothing moved; ${what}`) };
}

/** The reader's words for what a note line stored. */
export const noteWord = kind => NOTE_WORD[kind] ?? '';

/** The reader's words for the dossier fields a line wrote ("place, goal stored"; a field this list lacks is named as it is). */
export const fieldWords = keys => [...new Set(keys.map(key => FIELD_WORD[key] ?? key))].join(', ') + ' stored';
