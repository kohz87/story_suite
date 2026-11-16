// Route codes and travel modes for pre-modern and modern world packs.

export const ROUTE_CODES = Object.freeze({
    W: 'river or canal',
    R: 'maintained road',
    L: 'local',
    B: 'bastion road',
    F: 'frontier road',
    C: 'caravan',
    A: 'aerial',
    G: 'dungeon approach',
    S: 'sea',
    T: 'trail',
    M: 'mountain',
    U: 'tunnel',
    H: 'hidden',
    X: 'seasonal or expedition',
    D: 'deep sea',
});

export const MODES = Object.freeze(['foot', 'ride', 'wagon', 'boat', 'ship', 'flight', 'courier']);

// Modern travel (0.9.0): a pack with `"era": "modern"` (or `pace_km_per_hour`) uses these road
// codes and modes, paces in km an hour, and times in hours. Each code says which modes may use
// it and how fast; a mode a code leaves out cannot use it. A pack's own paces are merged over
// these, and may add codes of its own (one to three capital letters).
export const MODERN_MODES = Object.freeze(['foot', 'bike', 'car', 'motorbike', 'bus', 'train', 'metro', 'ferry', 'ship', 'plane']);
export const MODERN_CODES = Object.freeze({
    MW: { name: 'motorway or highway', paces: { car: 100, motorbike: 100, bus: 80 } },
    RD: { name: 'road', paces: { car: 60, motorbike: 60, bus: 45, bike: 18, foot: 5 } },
    ST: { name: 'city streets', paces: { car: 25, motorbike: 25, bus: 18, bike: 15, foot: 5 } },
    OR: { name: 'off-road or dirt track', paces: { car: 30, motorbike: 30, bike: 10, foot: 4 } },
    TR: { name: 'trail or footpath', paces: { bike: 12, foot: 4 } },
    RL: { name: 'railway', paces: { train: 90 }, board: 0.25 },
    HS: { name: 'high-speed rail', paces: { train: 250 }, board: 0.5 },
    MT: { name: 'metro, subway or tram', paces: { metro: 30 } },
    FY: { name: 'ferry', paces: { ferry: 30, car: 30, motorbike: 30, bike: 30, foot: 30 }, board: 0.5 },
    SL: { name: 'sea lane', paces: { ship: 35 }, board: 1 },
    AR: { name: 'air route', paces: { plane: 750 }, board: 2 },
});
