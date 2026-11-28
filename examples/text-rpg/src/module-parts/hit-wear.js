// A `? try` whose hit wounds also wears one piece the roller has on: the piece the hit names, else the body armour, else the shield; a scuff for one wound stage, a tear for more, never a ruin. The narrator's own wear line for that piece in the same reply wins.
// Only for a reply with the core rule mark `hitWear`, and only while the inventory's gear is on (`gear.view` answers nothing otherwise).

import { ask } from './gear.js';

// The inventory's own story wear amounts (STORY_WEAR; a test holds the two equal), and the word the receipt says.
export const WEAR = Object.freeze({ scuff: Object.freeze({ amount: 5, said: 'scuffed' }), tear: Object.freeze({ amount: 15, said: 'torn' }) });

// The places a hit can be taken on, in a fixed order. The weapon is left out: a weapon word in `hit:` is the attacker's ("a sword cut"), not the roller's.
const PLACES = Object.freeze(['body', 'off-hand', 'head', 'cloak', 'feet', 'accessory-1', 'accessory-2']);
const SLOT_WORDS = Object.freeze({
    body: ['body', 'armour', 'armor'], 'off-hand': ['shield', 'offhand'], head: ['head'], cloak: ['cloak'], feet: ['feet', 'foot'],
    'accessory-1': ['accessory'], 'accessory-2': ['accessory'],
});
// Words of an item's name that say what it is made of, or what strikes, never which piece was struck ("an iron bar" is not the Iron Cap).
const NOT_NAMING = new Set(('iron steel bronze copper silver gold bone wood wooden stone leather cloth hide fire frost ice shadow blood ' +
    'wolf bear boar claw fang tooth teeth tusk horn talon spike thorn blade arrow spear sword dagger hammer club ' +
    'with from that this black white green dark heavy light fine plain worn torn').split(' '));

const wordsOf = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/off[\s-]*hand/g, 'offhand').split(/[^\p{L}]+/u).filter(Boolean);
const single = word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);

/**
 * The piece of `slots` (gear.view's, by place) that `hit` wears, or null: the one unbroken piece a word of whose name the hit says, else the one whose
 * slot word it says (two or more that fit name none), else the body armour, else the shield.
 */
export function pieceFor(slots, hit) {
    const said = new Set(wordsOf(hit).map(single));
    const worn = PLACES.map(place => ({ place, piece: slots?.[place] })).filter(({ piece }) => piece?.stack && piece.broken !== true);
    const only = fits => {
        const found = worn.filter(fits);
        return found.length === 1 ? found[0].piece : null;
    };
    const named = only(({ piece }) => wordsOf(piece.name).map(single).some(word => word.length > 3 && !NOT_NAMING.has(word) && said.has(word)));
    const slotted = () => only(({ place }) => SLOT_WORDS[place].some(word => said.has(single(word))));
    return named ?? slotted() ?? worn.find(({ place }) => place === 'body')?.piece ?? worn.find(({ place }) => place === 'off-hand')?.piece ?? null;
}

// The reply's own `~ item Name … | wear:` names, from its <Changes> blocks (hidden or not; not those in its reasoning). A capture handler is given the reply
// without its block, so the text is read from SillyTavern's chat, at the message the capture reads. The line is read here: the example imports no core file.
const REASONING = /<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi;
const BLOCK = /<Changes>([\s\S]*?)(?=<\/Changes>|<Changes>|$)/gi;
const WEAR_LINE = /^[\s>*_`•]*(?:\d+[.)]\s+)?~\s*item\b\s*:?\s*(.*)$/i;
function narratorWorn(index) {
    const text = String(globalThis.SillyTavern?.getContext?.()?.chat?.[index]?.mes ?? '').replace(REASONING, '');
    return [...text.matchAll(BLOCK)].flatMap(([, body]) => body.split(/\r?\n/)).flatMap(line => {
        const [first, ...labels] = (WEAR_LINE.exec(line.replace(/\*\*|__|`|\^/g, ''))?.[1] ?? '').split('|');
        if (!labels.some(part => /^\s*wear\s*:/i.test(part))) return [];
        return [first.split(/[—–]|\s-\s/)[0].trim()];
    });
}

// Does one of those names mean `stack`, by the inventory's own name matching (`inventory.find`)?
const means = (query, name, stack) => {
    const found = ask(query, 'inventory.find', { name });
    return found?.status === 'found' && found.stacks.some(other => other.stack === stack);
};

/**
 * Wears the piece for `member`'s hit of `stages` wound stages and returns the receipt's words ("Wrapped Forearms scuffed"), else ''. When the reply's own `~ item … | wear:` line
 * names the piece, the code leaves it to that line, wherever it stands: no other piece is worn and no claim is taken. Else it takes that line's
 * once-a-reply claim (inventory story-wear.js), so two hits wear a piece once.
 */
export function hitWear(ctx, member, hit, stages) {
    if (ctx.carrier?.rules?.includes('hitWear') !== true || !(stages > 0)) return '';
    const names = narratorWorn(ctx.carrier.index);
    const narrated = piece => names.some(name => means(ctx.query, name, piece.stack));
    // (a piece this reply's own wear line names is picked as if unbroken: a ruin run before the try must not send the wear on to another piece)
    const slots = Object.entries(ask(ctx.query, 'gear.view', { owner: member.pc ? 'party' : member.id })?.slots ?? {})
        .map(([place, piece]) => [place, piece?.broken === true && narrated(piece) ? { ...piece, broken: false } : piece]);
    const piece = pieceFor(Object.fromEntries(slots), hit);
    if (!piece || narrated(piece)) return '';
    if (!ctx.claim(`wear:${ctx.carrier?.sid ?? ctx.receiptId ?? ''}:${piece.stack}`)) return '';
    const { amount, said } = WEAR[stages > 1 ? 'tear' : 'scuff'];
    const now = ctx.call('inventory.wear', { stack: piece.stack, amount })?.data?.now;
    return `${piece.name} ${now === 0 ? 'broken' : said}`;
}
