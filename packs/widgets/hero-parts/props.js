// The props the hero card accepts.

export const heroProps = {
    name: { type: 'string', required: true, default: '' },
    portrait: { type: 'string', default: '' },          // the persona avatar or the card's image
    portraits: { type: 'array', default: Object.freeze([]) }, // more pictures, in the order to try them (after `portrait`'s own place: see pictureCandidates)
    portraitQuery: { type: 'string', default: '' },     // a query that answers a picture URL (`npc.portrait`); asked first
    portraitArgs: { type: 'object', default: null },    // its arguments ({ name })
    line: { type: 'string', default: '' },               // the line under the name, whole ("Soul Class II · Wayfarer")
    className: { type: 'string', default: '' },          // else it is built from the class
    title: { type: 'string', default: '' },              // and a title ("Wayfarer")
    level: { type: 'string', default: '' },              // the level ("Lv 12"): the badge on the portrait (a star and the number)
    bars: { type: 'array', default: Object.freeze([]) }, // [{ kind: hp|mp|sp|exp, label, value, max, text }]
    place: { type: 'string', default: '' },
    time: { type: 'string', default: '' },
    weather: { type: 'string', default: '' },
    statuses: { type: 'array', default: Object.freeze([]) }, // [{ id, label, icon, left, unit, tone }]
    where: { type: 'object', default: null },          // { present: [names], places: [place names or { name }], weatherOn: bool (the feature is on), place, weatherText (the whole words the editor starts from) }: the corner's Here item and the Edit button
    you: { type: 'object', default: null },             // { rank?, rankLabel?, wearing, condition, command }: the rows under the place line (and the editor's Character group)
    clock: { type: 'object', default: null },           // { parts: { year, month, day, minutes } | null, era, months: [{ name, days }] }: the editor's date and time fields (Story Director's clock); none without it
    travel: { type: 'string', default: '' },            // the trip's line (Story Director's `atlas.trip` row): a Travel row under the `you` rows
    compact: { type: 'boolean', default: false },
    boardExpandable: { type: 'boolean', default: false },
};
