// The drive rule number, the list strength, the seven drives and their opposite-cue lists.

export const DRIVE_RULE = 1;
export const DRIVE_LIST_STRENGTH = 3;

export const DRIVES = Object.freeze([
    { kind: 'belonging', key: 'belo', label: 'Belonging', words: ['belong', 'family', 'kin', 'friend', 'party', 'lonely'] },
    { kind: 'closure', key: 'clos', label: 'Closure', words: ['unfinished', 'closure', 'unresolved', 'debt', 'unanswered'] },
    { kind: 'awe', key: 'awe', label: 'Awe', words: ['wonder', 'awe', 'marvel', 'mystic', 'curious'] },
    { kind: 'preservation', key: 'pres', label: 'Preservation', words: ['protect', 'preserve', 'guard', 'shield', 'defend'] },
    { kind: 'comfort', key: 'comf', label: 'Comfort', words: ['comfort', 'rest', 'cozy', 'warm', 'food'] },
    { kind: 'conflict', key: 'conf', label: 'Conflict', words: ['rival', 'feud', 'quarrel', 'fight', 'rage'] },
    { kind: 'honesty', key: 'hone', label: 'Honesty', words: ['honest', 'truth', 'candid', 'sincere', 'frank'] },
]);
// Short opposite-cue lists: a cue here pushes the drive down one level (rule 1).
export const OPPOSITES = Object.freeze({
    belo: ['alone', 'aloof', 'distant', 'loner'],
    clos: ['indifferent', 'careless', 'forget', 'forgot'],
    awe: ['bored', 'dull', 'mundane', 'jaded', 'cynical'],
    pres: ['reckless', 'abandon', 'neglect', 'expose'],
    comf: ['austere', 'ascetic', 'spartan', 'hardship'],
    conf: ['peaceful', 'calm', 'gentle', 'forgive', 'truce'],
    hone: ['lied', 'lying', 'liar', 'lies', 'lie', 'deceit', 'deceive', 'dishonest', 'untruthful'],
});
