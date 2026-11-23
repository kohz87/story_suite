// Difficulty words and the lowest difficulty a scene's pressure allows.

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampIndex(value) {
    return Math.min(4, Math.max(0, Math.trunc(value)));
}

const words = [
    { word: 'easy', dc: 8 },
    { word: 'normal', dc: 12 },
    { word: 'hard', dc: 16 },
    { word: 'very hard', dc: 20 },
    { word: 'near impossible', dc: 24 },
];

/** The five difficulty words and their target numbers, in rising order. */
export const DIFFICULTIES = Object.freeze(words.map(item => Object.freeze({ ...item })));

/** The position of a difficulty word, without case; an unknown word is normal (1). */
export function difficultyIndex(word) {
    const text = typeof word === 'string' ? word.trim().toLowerCase() : '';
    const index = DIFFICULTIES.findIndex(item => item.word === text);
    return index < 0 ? 1 : index;
}

/** The lowest difficulty index allowed by a threat, crowd, fatigue and conditions (capped at 4). */
export function floorIndex(input = {}) {
    const { threat, count, drained, physical, conditions } =
        input && typeof input === 'object' ? input : {};
    const threatLevel = Math.min(5, Math.max(0, Math.trunc(finite(threat, 0))));
    let floor = Math.min(4, Math.max(0, threatLevel - 1));

    const crowd = Math.max(0, Math.floor(finite(count, 0)));
    if (crowd > 2) floor += Math.ceil(Math.log2(crowd / 2));

    if (drained && physical) floor += 1;

    const conditionCount = Math.max(0, Math.floor(finite(conditions, 0)));
    floor += conditionCount;
    return Math.min(4, floor);
}

/** Raise a difficulty index to a floor; says whether the floor changed it. */
export function raiseToFloor(index, floor) {
    const current = Number.isFinite(index) ? clampIndex(index) : 1;
    const minimum = Number.isFinite(floor) ? clampIndex(floor) : 0;
    const raised = minimum > current;
    return { index: raised ? minimum : current, raised };
}
