// Modern travel constants for transfers, defaults, and self-driven modes.

// Trains, planes and boats are reached by a short ride or walk: a hop the mode cannot take,
// up to this long, goes by the first of these that can (a taxi, else on foot).
export const TRANSFER_MODES = ['car', 'foot'];
export const TRANSFER_KM = 60;
// The mode a modern leg most likely means when it names only a road code.
export const MODERN_DEFAULT_MODE = { MW: 'car', RD: 'car', ST: 'foot', OR: 'car', TR: 'foot', RL: 'train', HS: 'train', MT: 'metro', FY: 'ferry', SL: 'ship', AR: 'plane' };
// Modes someone drives, rides or walks themselves: they stop for the night on long trips.
export const SELF_MODES = ['foot', 'bike', 'car', 'motorbike'];
