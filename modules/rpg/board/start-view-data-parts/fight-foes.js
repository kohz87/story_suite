// Reads the standing foe groups of a staged or opened fight into plain text and numbers.
import { foeLabel } from '../../foes.js';
import { STAGES, stageWord } from '../../names.js';
import { readSheet } from '../../read.js';
import { text as sentence } from '../../../../../../../ui/legacy/view/widgets/dom.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const list = value => (Array.isArray(value) ? value : []);
const whole = value => (Number.isSafeInteger(value) ? value : null);
const slotOf = value => {
    if (Number.isSafeInteger(value)) return value;
    if (typeof value === 'string' && /^\d+$/u.test(value.trim())) return Number(value);
    if (Number.isSafeInteger(value?.slot)) return value.slot;
    return null;
};

const sessionOf = fight => (isObject(fight?.session) ? fight.session : isObject(fight?.board) ? fight.board : fight);

export function foeFrom(source) {
    const name = sentence(source?.name, 60);
    if (!name) return null;
    const count = whole(source?.count) ?? 1;
    const level = whole(source?.level);
    const size = whole(source?.size) ?? 5;
    const hurt = Number.isFinite(source?.hurt) ? Math.max(0, Math.min(size, source.hurt)) : null;
    const health = sentence(source?.word ?? source?.healthWord, 40) || (hurt === null ? 'Unhurt' : stageWord(STAGES.health, hurt, size));
    const countText = count > 1 ? ` ×${count}` : '';
    const levelText = level === null ? '' : ` · ${foeLabel(level)}`;
    return { name, count, level, hurt, size, health, label: `${name}${countText}${levelText}` };
}
export const countName = foe => `${foe.name}${foe.count > 1 ? ` (${foe.count})` : ''}`;
/** The standing groups of a staged/opened fight, with the sheet's names, levels and health when `state` is given. */
export function fightFoes(fight, state = null) {
    const session = sessionOf(fight);
    if (!isObject(session)) return [];
    const explicit = list(session.foes).map(foeFrom).filter(Boolean);
    const sheet = state ? readSheet(state) : null;
    const groups = new Set(list(session.groups).map(slotOf).filter(value => value !== null));
    if (sheet && groups.size) {
        const found = sheet.foes.filter(foe => foe.filled && groups.has(foe.slot)).map(foeFrom).filter(Boolean);
        if (found.length) return found;
    }
    if (explicit.length) return explicit;
    const order = list(session.setup?.order ?? session.order ?? resultOf(session.result)?.order);
    return order.filter(entry => entry && entry.party !== true).map(entry => foeFrom({ name: entry.name })).filter(Boolean);
}
