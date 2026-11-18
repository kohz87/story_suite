// The Ersveil preset of the format 3 → 4 converter: the ids, names and versions of the two packs, and the lead's climate proposal for each of the
// 30 regions (pack format 4 §3.2, D9), from the region's own weather lines, its places' tags and its lore. The author confirms them (§3.4).

/** Region id → `[climate or null, why]`. `null`: no proposal (the region reads as temperate); the notes list it for the author. */
const CLIMATES = {
    'highmark-empire': ['temperate', 'river capital and walled farmland in the middle of the continent; the general (temperate) lines fit'],
    'confederacy-heartland': ['temperate', 'river ports and the River Council; the general (temperate) lines fit'],
    'bluewatch-reach': ['cold', 'its weather lines: snow from autumn, hard frost, braziers; "northernmost village"'],
    'ledger-locks': ['temperate', 'river locks, levees and reed marsh; no weather lines of its own'],
    shornmarch: ['cold', 'its weather lines: first snow in the pines, the river iced over, blizzards on the bastion road'],
    'auvoth-compact': ['cold', 'its weather lines: short cool summer, heavy snow from autumn'],
    aurelion: [null, 'no weather lines and nothing in the lore about its air (pilgrim roads, plains)'],
    'kingdom-of-ashmere': [null, 'no weather lines; the lore names only its winter court'],
    'valegard-region': ['temperate', 'farmland and fen between the Border Kingdoms and the south; no weather lines of its own'],
    'border-kingdoms': ['cold', 'northern forest kingdoms sharing "winter logistics" (lore)'],
    ironanvil: ['highland', 'its weather lines: snowmelt in the gorges, cloud sea below the passes, blizzards on the heights; the Dragonfang Mountains'],
    'united-chieftainates': ['arid', 'its weather lines: steppe wind, heat shimmer over the grass, steppe blizzards; plains, mesas and steppe (lore)'],
    'stormmere-isles': ['sea', 'the Tidebound weather lines (gales, high seas, sea mist); island ports and a sea-fort'],
    'atlantis-region': ['underground', 'under a sea dome with no sky; its weather lines are dome-light and current, closest to the built-in "no sky" lines'],
    verdantleaf: ['warm', 'its weather lines: soft rain, warm mist, mild grey winters with a rare frost; the far south'],
    'fairy-court': ['tropical', 'canopy rainforest (lore); it shares Verdantleaf\'s weather lines'],
    'ardelian-empire-and-southmarch': ['highland', 'the southern highlands (lore); its weather lines: dry upland wind, snow squalls in winter'],
    'glass-wastes-and-ashkaran-dominion': ['arid', 'its weather lines: glass-dust storms, scorching noon, freezing dawn; desert places'],
    'startrace-tower-region': ['arid', 'its weather lines: dust storms, cold nights; a desert place'],
    shackles: ['arid', 'its weather lines: dust over the yards, hot and dry; desert places'],
    'bloodbound-league': ['arid', 'its weather lines: dust storms, heat shimmer, cold nights'],
    'wallwright-league': [null, 'no weather lines and nothing in the lore about its air'],
    'silver-mark': [null, 'no weather lines and nothing in the lore about its air'],
    deepwalkers: ['highland', 'mountain and mining places (its underground places already read as "no sky" by their layer)'],
    'emerald-coast': ['coastal', 'its weather lines: sea fog, squalls off the sea, storm-season swell; harbour towns'],
    'ashen-veil': ['arid', 'its weather lines: ash-grey dust, heat shimmer, cold nights (with marsh fog)'],
    'deep-northern-apex': ['frozen', 'its weather lines: whiteout, aurora, killing cold; icefields and glaciers'],
    'southern-wilds': ['tropical', 'its weather lines: torrential rain, oppressive heat, insects; marsh and deep forest'],
    'western-barrens': ['arid', 'its weather lines: dust storms, heat shimmer; desert places and well towns'],
    'wildzone-sites': [null, 'its sites differ too much (a misty forest, a storm peak, floating islands): set a climate on each place instead'],
};

/** Format 3 weather tables keyed by a region fragment that no region name contains: the region they meant. */
const WEATHER_REGIONS = { Tidebound: 'stormmere-isles', Apex: 'deep-northern-apex' };

export const ERSVEIL_PRESET = Object.freeze({
    source: 'examples/packs/ersveil-world/pack.json',
    world: { version: '4.0.0' },
    game: {
        id: 'ersveil-game',
        version: '1.0.0',
        name: 'Ersveil rules',
        description: 'Calendar, coins, guild ranks, names and trackers for Ersveil',
    },
    climates: CLIMATES,
    weatherRegions: WEATHER_REGIONS,
});
