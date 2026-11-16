// Shared world fixture and scene helper for initiative-*.test.js.
import { makeState, story } from './helpers/fake-ctx.js';

export const WORLD = [{ lines: [
    '~ time March 3, 2026, 08:00 am',
    '+ hook Wolf Contract — wolves at the fold | giver: Elula | goal: Kill 3 wolves | reward: 4 silver | due: March 4, 2026',
    '+ agenda Bram — moves salt at night | now: the docks',
    '+ hook Ferry Fee — the toll went up | giver: Orsa',
    '+ secret Elula Debt — Elula owes the smugglers',
].join('\n') }];

export function withScene(state, { place = 'Harrow', region = '', present = ['Elula', 'Bram', 'A Passer-by'] } = {}) {
    const next = structuredClone(state);
    next.domains.scene = { place: { name: place, kind: '', region }, present };
    return next;
}

export const base = () => withScene(story(WORLD, makeState()));
