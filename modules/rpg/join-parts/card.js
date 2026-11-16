// Join: the card under a reply that offers a companion.

import { oneLine } from '../../../core/text.js';
import { CLASS_NAMES, PARTY_ACTIVE } from '../names.js';
import { RPG_STRINGS, fill } from '../strings.js';
import { levelOfClass } from '../formula.js';
import { benchable } from './party.js';
import { JOIN_ADD, JOIN_BENCH, JOIN_NO } from './commands.js';

const J = RPG_STRINGS.join;

/** A bench button's label: the name is cut with an ellipsis so " · Lv N" always stays inside the card's 32-character action label. */
function benchLabel({ name, level }) {
    const tail = fill(J.benchOne, { name: '', level });
    const room = Math.max(1, 32 - [...tail].length);
    const chars = [...oneLine(name, 1000)];
    return fill(J.benchOne, { name: chars.length > room ? `${chars.slice(0, room - 1).join('').trimEnd()}…` : chars.join(''), level });
}

/** The card under the reply for the first offer, in reply-cards.js's shape, or null. */
export function joinCard(offers, state = null, isMe = () => false) {
    const offer = offers.find(entry => !entry.done) ?? offers[0];
    if (!offer) return null;
    if (offer.done) return { tone: 'good', icon: 'fa-user-check', title: J.benchDoneTitle, text: fill(J.benchDone, { left: offer.benched, name: offer.name }), rows: [], actions: [] };
    // (a full party, 4 active: one button per member who may step out, and Not now; the offer's request stays in the reply's receipt)
    if (offer.full) {
        const payload = { name: offer.name, about: offer.about, soul: offer.soul, best: offer.best, ...(offer.skills ? { skills: offer.skills } : {}) };
        // (room for Not now: a card keeps 4 buttons, so a chat with more than 4 active shows 3 members until Not now is used)
        const actions = benchable(state, isMe).slice(0, offer.declined ? 4 : 3).map(member => ({ id: `bench-${member.module}`.slice(0, 40), label: benchLabel(member), icon: 'fa-person-walking-arrow-right', command: JOIN_BENCH, payload: { ...payload, bench: member.name } }));
        if (!offer.declined) actions.push({ id: 'no', label: J.benchNot, icon: 'fa-xmark', command: JOIN_NO, payload: { name: offer.name } });
        return { tone: 'accent', icon: 'fa-flag', title: fill(J.benchTitle, { max: PARTY_ACTIVE }), rows: [],
            text: fill(offer.declined ? J.benchDeclined : J.benchWho, { name: offer.name }), actions };
    }
    // (a cast member's signature skills, as the pack had them when the line came, go with Edit first: the wizard's draft keeps them marked)
    const payload = { name: offer.name, about: offer.about, soul: offer.soul, best: offer.best, ...(offer.skills ? { skills: offer.skills } : {}) };
    // (the class a line writes stands for a level, 10n - 5: the card says the level the companion will start at)
    const rows = [{ icon: 'fa-star', text: fill(J.rowLevel, { level: levelOfClass(CLASS_NAMES[offer.soul - 1] ? offer.soul : 1) }) }];
    if (offer.best) rows.push({ icon: 'fa-arrow-up', text: fill(J.rowBest, { stat: offer.best.toUpperCase() }) });
    return {
        tone: 'accent', icon: 'fa-user-plus', title: fill(J.title, { name: offer.name }), text: offer.about, rows,
        actions: [
            { id: 'add', label: J.add, icon: 'fa-check', primary: true, command: JOIN_ADD, payload: offer.four ? { ...payload, four: true } : payload },
            { id: 'edit', label: J.edit, icon: 'fa-pencil', open: 'story-block/new-character', payload },
            { id: 'no', label: J.no, icon: 'fa-xmark', command: JOIN_NO, payload: { name: offer.name } },
        ],
    };
}
