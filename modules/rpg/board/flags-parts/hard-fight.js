// Decides whether a fight on a sheet plays the harder-foes rule.

/**
 * Whether a fight on this sheet plays the harder-foes rule (`setup.foesHard`): the party has the doubled bars (every character scale 2; the rule's hits are tuned for that
 * Health) and every foe is on a new Foes block. Filled foes decide; with none filled (the odds shown in Settings) the Foes block's slots do. One predicate for the board's
 * opening and the odds, so what is shown is what is played.
 */
export const hardFightFor = sheet => {
    const characters = sheet?.characters ?? [], foes = sheet?.foes ?? [], filled = foes.filter(foe => foe.filled), list = filled.length ? filled : foes;
    return characters.length > 0 && characters.every(actor => actor.scale === 2) && list.length > 0 && list.every(foe => foe.hard === 1);
};
