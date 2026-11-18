// The job: the blank packs New world and New game open (mock MK-9). A blank pack passes the pack check as it is: format 4, its kind,
// version 0.1.0, the name and id given, `requires.suite` for this suite's version line, and nothing in `content` yet (an empty game part
// is the Built-in game's).
//
// blankPack(kind, { name, id }) → the pack document (keys in the checker's order). idFromName(name) → an id made from a name ('' when
// nothing in it can make one). idProblem(id) → why the checker would refuse the id, in words, or '' when it takes it.

import { PACK_FORMAT, PACK_ID } from '../../packs/limits.js';
import { SUITE_VERSION, slugify } from '../../packs/validate.js';

const ID_MAX = 40;
const SUITE_RANGE = `^${SUITE_VERSION.split('.').slice(0, 2).join('.')}`;

export function idFromName(name) {
    return slugify(name).slice(0, ID_MAX).replace(/-+$/, '');
}

export function idProblem(id) {
    const text = String(id ?? '');
    if (!text) return 'A pack needs an id.';
    if (!PACK_ID.test(text)) return 'Use 1 to 40 lowercase letters, digits and single dashes, starting and ending with a letter or digit.';
    if (text === 'chat') return 'The id "chat" is kept for blocks made in a chat; pick another.';
    return '';
}

export function blankPack(kind, { name = '', id = '' } = {}) {
    const title = String(name).trim();
    return {
        id: String(id).trim(),
        format: PACK_FORMAT,
        kind: kind === 'game' ? 'game' : 'world',
        version: '0.1.0',
        ...(title ? { name: title } : {}),
        requires: { suite: SUITE_RANGE },
        content: {},
    };
}
