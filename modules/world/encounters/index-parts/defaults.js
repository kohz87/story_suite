// The built-in backdrop people (setting-agnostic: no pack names, currencies or factions) by place group, and how often a place is
// quiet by its engine class. A pack's own backdrops (backdrops.js) come before these; the defaults are anonymous (never "seen
// before", never promoted).

/** The weight of "nothing worth noting" by place class (spec §1 classes): a busy place is quiet less often. */
export const QUIET_WEIGHTS = Object.freeze({ capital: 3, city: 4, town: 6, village: 8, outpost: 8, site: 10, none: 14 });

const row = (group, id, who, look, when = []) => Object.freeze({ id: `default-${group}-${id}`, who, look, groups: [group], when, weight: 1, recurring: false, source: 'default' });

/** The default backdrop rows, one list for every place group (pulse place-groups.js: wild, town, indoors, road, water). */
export const DEFAULT_BACKDROPS = Object.freeze([
    row('town', 'hawker', 'a hawker', 'crying their wares to anyone who slows down', ['morning', 'midday', 'afternoon']),
    row('town', 'watch', 'a watchman', 'walking the rounds and eyeing strangers'),
    row('town', 'errand', 'a child on an errand', 'weaving through the crowd with a bundle', ['morning', 'midday', 'afternoon']),
    row('town', 'carter', 'a carter', 'easing a loaded cart through the narrow way', ['dawn', 'morning', 'midday', 'afternoon']),
    row('indoors', 'server', 'a tired server', 'clearing cups between the tables'),
    row('indoors', 'regular', 'a regular in the corner', 'nursing a drink and listening to everything'),
    row('indoors', 'musician', 'a musician', 'tuning up for the evening', ['afternoon', 'evening']),
    row('road', 'pedlar', 'a pedlar', 'bent under a pack of small goods', ['dawn', 'morning', 'midday', 'afternoon']),
    row('road', 'pilgrims', 'a pair of travellers', 'heading the other way with their heads down'),
    row('road', 'herder', 'a herder', 'moving a few animals along the verge', ['dawn', 'morning', 'afternoon']),
    row('water', 'boatman', 'a boatman', 'mending a net or a line by the water'),
    row('water', 'dockhand', 'a dockhand', 'hauling crates and swearing at the weight', ['dawn', 'morning', 'midday', 'afternoon']),
    row('wild', 'hunter', 'a hunter', 'watching from the edge of the trees', ['dawn', 'morning', 'evening']),
    row('wild', 'forager', 'a forager', 'filling a basket, wary of company', ['morning', 'midday', 'afternoon']),
]);
