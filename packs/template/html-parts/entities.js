// Decodes character references (`&amp;`, `&#58;`, `&#x3A;`) in template text and attribute values.

const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', copy: '©', reg: '®', trade: '™',
    hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    middot: '·', bull: '•', times: '×', divide: '÷', deg: '°', plusmn: '±', larr: '←', rarr: '→', uarr: '↑',
    darr: '↓', harr: '↔', hearts: '♥', diams: '♦', clubs: '♣', spades: '♠', star: '☆', sect: '§', para: '¶',
    frac12: '½', frac14: '¼', frac34: '¾', le: '≤', ge: '≥', ne: '≠', minus: '−', infin: '∞', check: '✓',
    tab: '\t', newline: '\n', colon: ':', lpar: '(', rpar: ')', sol: '/', bsol: '\\', semi: ';', comma: ',',
    period: '.', excl: '!', quest: '?', num: '#', percnt: '%', equals: '=', grave: '`', lbrace: '{', rbrace: '}',
};

/** Decode character references (`&amp;`, `&#58;`, `&#x3A;`, also without the `;` for numbers). */
export function decodeEntities(text) {
    if (!text.includes('&')) return text;
    return text.replace(/&(?:#(\d{1,7});?|#[xX]([0-9a-fA-F]{1,6});?|([A-Za-z][A-Za-z0-9]{1,31});)/g, (match, dec, hex, name) => {
        if (dec || hex) {
            const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
            if (!code || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '�';
            return String.fromCodePoint(code);
        }
        return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : match;
    });
}
