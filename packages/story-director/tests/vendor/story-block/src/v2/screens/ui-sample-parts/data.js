// The made-up data the sample's template draws (a hero, bars, tiles, lists, a map, a dialog).

// A made-up 64 px portrait (a base64 PNG), so the hero shows a picture beside the one with an initial.
const SAMPLE_PORTRAIT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAACxUlEQVR42u3YeU6aQRzG8d9ZegT/9iR23+wOooiggsoiiuCCCiqLIsq+ryIVrWvdqlbFrYfoETotiXkTCsaZgddJ3uQ5wOdL3pCZAVHTL1HTjfjxjfjJdcvTa8mzK8nzq9YXl21oLy+kry6kr4vtb4qyt+ey5vOO5jP5uzP5+zPFh1PFx9POTz+7PqOddH85UYqOleJjVcuRSnLU0/qjF63tsE96qG4/VMsONB0HGvm+Vr6vU+zpOvf6u3b13bt65fcBFdrOYM+OoXfb0Lc9pN4yaraM2i2TdtOk2xzu3xjRb4wMrI8Oro8ZvqGZh9bMxrVx0+rE8OrESGFytABM6y1jBWBabxlbAab1VvMKMK23jn8FpvVTEyiAZf30ZB6Y1k9b8sC0fsa6DEzrbSiAab1tKgdM6+3TOWBab59ZAqb1DhsKYFnvtGeBab3TkQXq+oZHjdVHUT/ryABF/Z107qjo55wZ4EVfGrl+bhYFEOsx6NyR6F1zaeBXXxq23uVKQy2+nN/FQqVVCMDUz8+noJ76Kg14erc7BRT1d9KrZ2Do3e4kUPy/Jw24v35hAQXwoa/UcF/94mIC8E4K5Pr/NtxXv+hBAQTnHGx3+TB+e6T3eONAckqjGYCl9/jiQHLGpBiAp/f6Y0ByQqYZgKX3oQCS8z3FADy9LxAFktsJxQA8vT+IAgjuVjQDsPSBUBRIboYUA/D0gXAECO+1/OqDkQgQ3sqpBGDrg9EwkL8p8KgP/Q0gfhEhDSDQh2MhoPKew5c+HA8BrdcoXvSRRBDovqXV57u/1UeTQajFS2CN/jHL9dFUAOr5jkldH0sHgGl9LO0HpvXxDApgWZ/I+uBOfWODiN9V0SeWfFBJz7u7fOX6ZM4L5foHSOeOq08te4Grf+B07kr6VB4F/NMzROcunfcAo/TbCQFCgBAgBAgBQoAQIAQQ7A9gt+fdUieuLgAAAABJRU5ErkJggg==';

/** Made-up data for the sample (the concept's Astra). */
export const UI_SAMPLE_DATA = Object.freeze({
    pc: Object.freeze({ name: 'Astra', line: 'Soul Class II · Lv 12 · Wayfarer', hp: { cur: 50, max: 82 }, mp: { cur: 32, max: 40 }, sp: { cur: 30, max: 34 }, exp: { cur: 640, max: 1000 } }),
    statuses: Object.freeze([
        Object.freeze({ id: 'bleed', label: 'Bleeding', icon: 'fa-droplet', left: 40, unit: 'minutes', tone: 'bad' }),
        Object.freeze({ id: 'haste', label: 'Haste', icon: 'fa-forward', left: 2, unit: 'rounds', tone: 'warn' }),
        Object.freeze({ id: 'poison', label: 'Poisoned', icon: 'fa-skull-crossbones', left: 3, unit: 'turns', tone: 'good' }),
        Object.freeze({ id: 'blessed', label: 'Blessed', icon: 'fa-star', left: null, unit: 'turns', tone: 'accent' }),
    ]),
    skills: Object.freeze([
        Object.freeze({ id: 'moon', label: 'Moonlight Slash', icon: 'fa-wand-sparkles', count: '3', state: 'none', selected: true, tone: 'info', hint: 'Lv 3' }),
        Object.freeze({ id: 'frost', label: 'Frost Hex', icon: 'fa-snowflake', count: '2', state: 'ready', selected: false, tone: 'info', hint: 'Lv 2' }),
        Object.freeze({ id: 'death', label: 'Death Soul', icon: 'fa-skull', count: '–', state: 'locked', selected: false, tone: '', hint: 'Needs Blade Soul Lv 3' }),
    ]),
    // The hero card (ss.hero): a portrait (a made-up picture here), HP/MP/SP and the experience word, the corner, the badges.
    hero: Object.freeze({
        name: 'Astra', portrait: SAMPLE_PORTRAIT, className: 'Soul Class II', level: '12', title: 'Wayfarer', place: 'North Cut', time: '07:20', weather: 'Drizzle',
        bars: Object.freeze([
            Object.freeze({ kind: 'hp', label: 'HP', value: 50, max: 82 }), Object.freeze({ kind: 'mp', label: 'MP', value: 32, max: 40 }),
            Object.freeze({ kind: 'sp', label: 'SP', value: 30, max: 34 }), Object.freeze({ kind: 'exp', label: 'Soul growth', value: 640, max: 1000 }),
        ]),
        statuses: Object.freeze([
            Object.freeze({ id: 'bleed', label: 'Bleeding', icon: 'fa-droplet', left: 40, unit: 'minutes', tone: 'bad' }),
            Object.freeze({ id: 'haste', label: 'Haste', icon: 'fa-forward', left: 2, unit: 'rounds', tone: 'warn' }),
            Object.freeze({ id: 'blessed', label: 'Blessed', icon: 'fa-star', left: null, unit: 'turns', tone: 'accent' }),
        ]),
    }),
    // The compact hero (the strip under a reply): no picture, so the initial.
    heroCompact: Object.freeze({
        name: 'Mira', className: 'Salvager', level: '9', compact: true,
        bars: Object.freeze([
            Object.freeze({ kind: 'hp', label: 'HP', value: 71, max: 84 }), Object.freeze({ kind: 'mp', label: 'MP', value: 12, max: 30 }), Object.freeze({ kind: 'sp', label: 'SP', value: 22, max: 28 }),
        ]),
        statuses: Object.freeze([Object.freeze({ id: 'poison', label: 'Poisoned', icon: 'fa-skull-crossbones', left: 3, unit: 'turns', tone: 'good' })]),
    }),
    tiers: Object.freeze({
        columns: 3, selected: 'frost', label: 'Skills',
        tiers: Object.freeze([
            Object.freeze({ title: 'Basic', tiles: Object.freeze([
                Object.freeze({ id: 'moon', label: 'Moonlight Slash', icon: 'fa-wand-sparkles', count: '3', tone: 'info', hint: 'Lv 3' }),
                Object.freeze({ id: 'blade', label: 'Blade Soul', icon: 'fa-khanda', count: '2', tone: 'info', hint: 'Lv 2' }),
                Object.freeze({ id: 'seal', label: 'Seal Release', icon: 'fa-circle-notch', count: '1', tone: 'info', hint: 'Lv 1' }),
            ]) }),
            Object.freeze({ title: 'Advanced', tiles: Object.freeze([
                Object.freeze({ id: 'corr', label: 'Corrosion', icon: 'fa-skull', count: '1', state: 'ready', tone: 'info', hint: 'Lv 1' }),
                Object.freeze({ id: 'frost', label: 'Frost Hex', icon: 'fa-snowflake', count: '2', state: 'ready', tone: 'info', hint: 'Lv 2' }),
                Object.freeze({ id: 'death', label: 'Death Soul', icon: 'fa-skull-crossbones', count: '–', state: 'locked', hint: 'Needs Blade Soul Lv 3' }),
            ]) }),
            Object.freeze({ title: 'Finisher', tiles: Object.freeze([
                Object.freeze({ id: 'plague', label: 'Plague Fang', icon: 'fa-tooth', count: '–', state: 'locked', hint: 'Needs Corrosion Lv 3' }),
                Object.freeze({ id: 'phantom', label: 'Phantom Flash', icon: 'fa-bolt', count: '1', state: 'ready', tone: 'info', hint: 'Lv 1' }),
                Object.freeze({ id: 'nether', label: 'Netherflame', icon: 'fa-fire', count: '–', state: 'locked', hint: 'Needs INT 14' }),
            ]) }),
        ]),
    }),
    ready: Object.freeze({
        title: 'Ready to turn in', label: 'Quests ready to turn in',
        rows: Object.freeze([
            Object.freeze({ id: 'wolf', title: 'The North Cut Wolf', sub: 'to Elula · here', value: '4 silver' }),
            Object.freeze({ id: 'weir', title: 'Rats in the Weir', sub: 'to Master Kroll · Guild Office', value: '12 pennies' }),
        ]),
    }),
    here: Object.freeze({
        title: 'What can happen here', selected: 'varney',
        rows: Object.freeze([
            Object.freeze({ id: 'kroll', title: 'Master Kroll wants a word', tag: 'new', tone: 'good' }),
            Object.freeze({ id: 'varney', title: 'Varney\'s wolves are still out there', tag: 'open', tone: 'warn' }),
            Object.freeze({ id: 'elula', title: 'Elula needs the elderbark wash', sub: 'Folk Bitter Draught', tag: 'urgent', tone: 'bad' }),
            Object.freeze({ id: 'rats', title: 'Trench rats of the East Ditch', tag: 'elsewhere' }),
        ]),
    }),
    people: Object.freeze({
        title: 'People here · 2',
        rows: Object.freeze([
            Object.freeze({ id: 'elula', title: 'Elula', sub: 'Overwhelmed, tearful', value: 'Close', icon: 'fa-user' }),
            Object.freeze({ id: 'kroll', title: 'Master Kroll', sub: 'Busy, curt', value: 'Acquaintance', icon: 'fa-user' }),
        ]),
    }),
    tabs: Object.freeze({
        label: 'Panel sections', current: 'world',
        items: Object.freeze(['World', 'Quests', 'Party', 'Bag', 'Fight', 'Crafting', 'Trade', 'Chronicle'].map(label => Object.freeze({ id: label.toLowerCase(), label }))),
    }),
    nav: Object.freeze({
        label: 'Game view', current: 'skills',
        items: Object.freeze([
            Object.freeze({ id: 'party', label: 'Party', icon: 'fa-users' }), Object.freeze({ id: 'skills', label: 'Skills', icon: 'fa-star' }), Object.freeze({ id: 'bag', label: 'Bag', icon: 'fa-bag-shopping', count: '2' }),
            Object.freeze({ id: 'fight', label: 'Fight', icon: 'fa-khanda' }), Object.freeze({ id: 'world', label: 'World', icon: 'fa-globe' }), Object.freeze({ id: 'map', label: 'Map', icon: 'fa-map' }),
            Object.freeze({ id: 'trade', label: 'Trade', icon: 'fa-scale-balanced' }),
        ]),
    }),
    // The map (ss.map): four places, a route between them, the reader's place, and one place not yet found (the fog, unknown).
    map: Object.freeze({
        label: 'Sample map', current: 'hollow', fog: 'unknown', discovered: Object.freeze(['hollow', 'mill', 'gate']),
        nodes: Object.freeze([
            Object.freeze({ id: 'hollow', name: 'Hollow Tree', x: 18, y: 66, icon: 'fa-tree', kind: 'camp' }),
            Object.freeze({ id: 'mill', name: 'Old Mill', x: 44, y: 44, icon: 'fa-gear', kind: 'town' }),
            Object.freeze({ id: 'gate', name: 'North Gate', x: 70, y: 28, icon: 'fa-torii-gate', kind: 'town' }),
            Object.freeze({ id: 'keep', name: 'Keep', x: 88, y: 10, icon: 'fa-chess-rook', kind: 'town' }),
        ]),
        edges: Object.freeze([Object.freeze({ from: 'hollow', to: 'mill' }), Object.freeze({ from: 'mill', to: 'gate' }), Object.freeze({ from: 'gate', to: 'keep' })]),
        kinds: Object.freeze({ camp: Object.freeze({ label: 'Camp', icon: 'fa-campground' }), town: Object.freeze({ label: 'Town', icon: 'fa-city' }) }),
    }),
    dialog: Object.freeze({
        title: 'Rest at the Guild Office?', text: 'Resting takes about eight hours of story time.\n\nThe wolf\'s bleeding will be closed, and Haste will run out.',
        actions: Object.freeze([Object.freeze({ id: 'cancel', label: 'Not now' }), Object.freeze({ id: 'rest', label: 'Rest', kind: 'primary', icon: 'fa-moon' })]),
    }),
    bag: Object.freeze([
        Object.freeze({ id: 'draught', label: 'Healing Draught', icon: 'fa-flask', count: '3', tone: 'neutral' }),
        Object.freeze({ id: 'bitter', label: 'Folk Bitter Draught', icon: 'fa-leaf', count: '1', tone: 'uncommon' }),
        Object.freeze({ id: 'ring', label: 'Silver Ring', icon: 'fa-ring', count: '', tone: 'rare' }),
        Object.freeze({ id: 'chit', label: 'Council Chit', icon: 'fa-key', count: '', tone: 'epic' }),
    ]),
});
