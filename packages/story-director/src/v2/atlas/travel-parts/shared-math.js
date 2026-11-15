// Shared rounding helper for travel time calculations.

export const tidy = value => Math.round(value * 1e9) / 1e9;
