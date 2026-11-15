// Default travel rules and courier multiplier constants.

export const MODERN_RULES = Object.freeze({ unit: 'hour', roundUpTo: 0.25, driveHoursPerDay: 10 });

export const DEFAULT_RULES = Object.freeze({
    roundUpTo: 0.5, restDayEvery: 6, crewedWaterRest: false, leveeRoads: [], noLevee: [],
});
export const DEFAULT_COURIER_MULTIPLIER = 2;
