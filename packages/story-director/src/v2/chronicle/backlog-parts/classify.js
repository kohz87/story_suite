// Story Director v2, chronicle part: classifies Journal happened lines into categories by receipt type or text shape.

import { BOOKKEEPING_TYPES, PRESENCE_TEXT, flat } from '../days/shared.js';

export const CATEGORIES = Object.freeze(['met', 'relationships', 'events', 'party', 'items', 'standing', 'fame', 'guild', 'reputation', 'news', 'places', 'bookkeeping']);
export const DEFAULT_CATEGORY = 'events';

// Receipt types by category. Story Block's presence, party, item, money and place receipts; Story Director's
// chronicle and atlas receipts; NPC State Delta's meter and presence receipts (`npc.meters`, `npc.set`, `npc.adjust`,
// `npc.present`); the Block's data-module results (`capture.dm`, `dm.act`) that are not a meter set: a stored type reads
// "capture.dm:<kind>" (the result's kind, see typeOf in days/facts.js) and the kind says what it is (DM_KINDS below); a line stored
// with no kind (older days) stays Reputation.
const BY_TYPE = new Map([
    ['capture.present', 'met'], ['scene.present', 'met'], ['npc.present', 'met'],
    ['capture.npc', 'relationships'], ['npc.meters', 'relationships'], ['npc.set', 'relationships'], ['npc.adjust', 'relationships'],
    ['capture.party', 'party'], ['item.equip', 'party'], ['capture.mount', 'party'],
    ['capture.item', 'items'], ['capture.coin', 'items'], ['wallet.receive', 'items'], ['wallet.pay', 'items'], ['wallet.set', 'items'],
    ['inventory.add', 'items'], ['inventory.edit', 'items'], ['inventory.carry', 'items'],
    ['rpg.fight', 'events'], ['capture.you', 'bookkeeping'], ['capture.weather', 'bookkeeping'],
    ['capture.dm', 'reputation'], ['dm.act', 'reputation'],
    ['capture.world', 'news'], ['capture.faction', 'news'], ['chronicle.world', 'news'],
    ['capture.place', 'places'], ['place', 'places'],
    ['atlas.visit', 'bookkeeping'], ['atlas.edit', 'bookkeeping'], ['atlas.focus', 'bookkeeping'], ['npc.tick', 'bookkeeping'],
]);
// The kinds of the Ersveil reputation blocks (Story Block's world pack): Standing (gain, loss) and Court favour (back, undermine), Fame
// (deed, spread), the Adventurer Guild (register, dues, contract, promote, yearend). Any other kind is an event of the day.
const DM_KINDS = new Map([
    ['gain', 'standing'], ['loss', 'standing'], ['back', 'standing'], ['undermine', 'standing'],
    ['deed', 'fame'], ['spread', 'fame'],
    ['register', 'guild'], ['dues', 'guild'], ['contract', 'guild'], ['promote', 'guild'], ['yearend', 'guild'],
]);
const PRESENT_TYPES = new Set(['capture.present', 'scene.present', 'npc.present']);

// The text shapes of a stored line without its type (older digests): the first that matches wins.
const SHAPES = [
    [/^Key people: noted/, 'bookkeeping'],
    [/\b(?:is|is not) here\.?$/i, 'bookkeeping'],
    [/\b(?:left the party|is back in the party|bound gear|Gear:)/i, 'party'],
    [/^Lost\b|^Found\b|\b(?:copper|silver|gold)\b/i, 'items'],
    [/\b(?:Adventurer Guild|Fame by region|membership)\b/i, 'reputation'],
    [/^[^:]{1,80}: (?:affection|trust|desire|respect|fear|stage)\b/i, 'relationships'],
    [/^(?:Went to|Took on|Finished|Failed|Gave up)\b/, 'events'],
];

/** The category of a stored line by its text alone (no receipt type): a known shape, else Events. */
export function classifyText(line) {
    const body = flat(line);
    const hit = SHAPES.find(([pattern]) => pattern.test(body));
    return hit ? hit[1] : DEFAULT_CATEGORY;
}

/** The Journal category of one happened line: `entry` is `{ type, text }` (a receipt's type and its summary); by type when known, else by text. */
export function classify(entry) {
    const type = typeof entry?.type === 'string' ? entry.type : '';
    const body = flat(entry?.text);
    if (type && BOOKKEEPING_TYPES.has(type)) return 'bookkeeping';
    if (PRESENT_TYPES.has(type) && PRESENCE_TEXT.test(body)) return 'bookkeeping';
    if (type === 'npc.tick' && !/^Key people: /.test(body)) return 'bookkeeping';
    if (type && BY_TYPE.has(type)) return BY_TYPE.get(type);
    const [base, kind] = type.split(':');
    if (kind && BY_TYPE.get(base) === 'reputation') return DM_KINDS.get(kind) ?? DEFAULT_CATEGORY;
    return classifyText(body);
}
