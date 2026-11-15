// Story Director: default map settings, travel paces and map settings normalizer.

export const DEFAULT_MAP = Object.freeze({ north: 'up', east: 'right', kmPerUnit: 1, roadFactor: 1.25, era: 'pre-modern' });

// Paces without a world pack, km per day.
export const DEFAULT_PACES = Object.freeze({ foot: 20, ride: 35, wagon: 18, boat: 35, ship: 110, flight: 130, courier: 70 });
// Modern paces without a world pack (0.9.0), km an hour door to door, and the hours spent boarding.
export const MODERN_PACES = Object.freeze({ foot: 5, bike: 15, car: 70, motorbike: 70, bus: 50, train: 90, metro: 30, ferry: 30, ship: 35, plane: 750 });

/** The map settings, completed and bounded. */
export function mapSettings(map = {}) {
    const given = map && typeof map === 'object' ? map : {};
    const km = Number(given.kmPerUnit);
    const factor = Number(given.roadFactor);
    return {
        north: given.north === 'down' ? 'down' : 'up',
        east: given.east === 'left' ? 'left' : 'right',
        kmPerUnit: km > 0 ? km : DEFAULT_MAP.kmPerUnit,
        roadFactor: factor >= 1 ? factor : DEFAULT_MAP.roadFactor,
        era: given.era === 'modern' ? 'modern' : 'pre-modern',
    };
}
