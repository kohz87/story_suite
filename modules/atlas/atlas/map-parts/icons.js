// Font Awesome icon lookup and legend label formatting for atlas kinds.

// Font Awesome icons (SillyTavern ships Font Awesome) by the words a kind is written with.
const ICONS = Object.freeze([
    [/\b(?:city|capital)\b/, 'fa-city'],
    [/\b(?:town|village|hamlet|settlement|farm|homestead)\b/, 'fa-house'],
    [/\b(?:castle|fort|fortress|keep|citadel|bastion|stronghold|watch)\b/, 'fa-chess-rook'],
    [/\b(?:ruin|ruins)\b/, 'fa-landmark'],
    [/\b(?:dungeon|crypt|tomb|catacomb|lair)\b/, 'fa-dungeon'],
    [/\b(?:cave|cavern|mine|grotto)\b/, 'fa-mountain-sun'],
    [/\b(?:temple|shrine|church|chapel|monastery|abbey)\b/, 'fa-place-of-worship'],
    [/\b(?:inn|tavern|alehouse)\b/, 'fa-beer-mug-empty'],
    [/\b(?:port|harbou?r|dock|docks|wharf|quay|pier|jetty)\b/, 'fa-anchor'],
    [/\b(?:camp|encampment|outpost)\b/, 'fa-campground'],
    [/\b(?:tower|spire|lighthouse)\b/, 'fa-tower-observation'],
    [/\b(?:bridge|ford|crossing|weir)\b/, 'fa-bridge'],
    [/\b(?:forest|wood|woods|grove|wild|wilds)\b/, 'fa-tree'],
    [/\b(?:mountain|peak|pass|hill|hills|ridge)\b/, 'fa-mountain'],
    [/\b(?:lake|river|sea|coast|shore|marsh|swamp|spring)\b/, 'fa-water'],
    [/\b(?:market|shop|bazaar)\b/, 'fa-shop'],
    [/\b(?:landmark|monument|statue|stone|stones)\b/, 'fa-monument'],
]);
export const DEFAULT_ICON = 'fa-location-dot';

/** The icon for a place kind: a Font Awesome class name. */
export function iconFor(kind) {
    const word = String(kind ?? '').toLowerCase();
    return ICONS.find(([pattern]) => pattern.test(word))?.[1] ?? DEFAULT_ICON;
}

export const label = word => word.charAt(0).toUpperCase() + word.slice(1);
