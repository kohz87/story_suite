// Numeric tolerances for distance, duration, and floating-point rounding.

export const KM_TOLERANCE = 0.05;
export const DAYS_TOLERANCE = 0.5;
// Float sums like 2.0000000001 must not round up to the next half day.
export const EPSILON = 1e-9;
