// The one prompt line that says what each recovery kind of a marked Character restores.
import { FULL_REST_HOURS } from './constants.js';

const refills = (kind, bars) => !Object.keys(kind.labels ?? {}).length && JSON.stringify(kind.effects) === JSON.stringify(bars.map(bar => ({ op: 'set', path: [bar], value: ['get', [`${bar}-blocks`]] })));
/** A recovery kind a pin offers as a story kind (a screen does not own it), or null. */
const storyKind = (definition, name) => (Object.hasOwn(definition?.kinds ?? {}, name) && definition.kinds[name]?.ui !== true ? definition.kinds[name] : null);
/** "1 to 3" from the heal kind's real label bounds when it only adds that amount to health; '' otherwise. */
const healBounds = kind => {
    const amount = kind?.labels?.amount, [effect, ...more] = kind?.effects ?? [];
    return kind && Object.keys(kind.labels).length === 1 && amount?.type === 'int' && Number.isSafeInteger(amount.min) && Number.isSafeInteger(amount.max) && amount.min >= 1 && amount.max >= amount.min
        && !more.length && JSON.stringify(effect) === JSON.stringify({ op: 'add', path: ['health'], value: ['arg', 'amount'], bounds: 'clamp' }) ? `${amount.min} to ${amount.max}` : '';
};

/** The one line that says what each recovery kind restores (views.js grammarFor adds it after a marked Character's lines); '' when no kind qualifies. */
export const restLine = definition => {
    const rest = storyKind(definition, 'rest'), full = storyKind(definition, 'full-rest'), heal = healBounds(storyKind(definition, 'heal'));
    const shortRest = rest && refills(rest, ['stamina', 'mana']), fullRest = full && refills(full, ['health', 'stamina', 'mana']);
    const clauses = [shortRest ? 'rest (an hour or two) refills mana and stamina' : '',
        fullRest ? `full-rest (a night's sleep, once in ${FULL_REST_HOURS} story hours) ${shortRest ? 'also health' : 'refills health, stamina and mana'}` : '',
        heal ? `heal (${heal}) only health` : ''].filter(Boolean);
    return clauses.length ? `Recovery: ${clauses.join('; ')}.` : '';
};
