// Icons: the default icon of each game view screen and tab, and which icon to draw for an id.

/** The default `ph-*` icon of the game view's screens and tabs, by full id or by the id's last part. */
export const TAB_ICONS = Object.freeze({
    'story-block/home': 'ph-house',
    'story-block/inventory': 'ph-backpack',
    'story-director/quests': 'ph-scroll',
    'story-director/world': 'ph-globe-hemisphere-west',
    'story-director/map': 'ph-map-trifold',
    'story-block/scene': 'ph-map-pin',
    'story-director/chronicle': 'ph-book-open',
    'story-director/director': 'ph-film-slate',
    'npc-state-delta/cast': 'ph-identification-card',
    home: 'ph-house',
    party: 'ph-users-three',
    inventory: 'ph-backpack',
    quests: 'ph-scroll',
    world: 'ph-globe-hemisphere-west',
    map: 'ph-map-trifold',
    fight: 'ph-sword',
    crafting: 'ph-hammer',
    trade: 'ph-scales',
    scene: 'ph-map-pin',
    chronicle: 'ph-book-open',
    director: 'ph-film-slate',
    cast: 'ph-identification-card',
    dossiers: 'ph-identification-card',
    savepoints: 'ph-bookmark-simple',
    settings: 'ph-gear-six',
});

/** The default `ph-*` icon for a screen or tab id (full id first, then its last part); '' when there is none. */
export function tabIcon(id) {
    if (typeof id !== 'string' || !id.trim()) return '';
    const key = id.trim().toLowerCase();
    if (Object.hasOwn(TAB_ICONS, key)) return TAB_ICONS[key];
    const tail = key.split('/').pop();
    return Object.hasOwn(TAB_ICONS, tail) ? TAB_ICONS[tail] : '';
}

/**
 * The icon to draw for a screen or tab: the suite's own icon for one of its screens (a full id in TAB_ICONS), else the
 * icon the screen or tab gives (`own`), else the default for its id's last part (tabIcon); '' when there is none.
 */
export function iconFor(id, own = '') {
    const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
    if (key.includes('/') && Object.hasOwn(TAB_ICONS, key)) return TAB_ICONS[key];
    const given = typeof own === 'string' ? own.trim() : '';
    return given || tabIcon(key);
}
