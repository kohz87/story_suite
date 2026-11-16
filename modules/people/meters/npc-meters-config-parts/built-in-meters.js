// The built-in meters, their value ranges and the tone words a meter may carry.

export const BUILT_IN_METERS = Object.freeze([
    Object.freeze({ id: 'trust', label: 'Trust', tone: 'info' }),
    Object.freeze({ id: 'affection', label: 'Affection', tone: 'good' }),
    Object.freeze({ id: 'desire', label: 'Desire', tone: 'accent' }),
    Object.freeze({ id: 'tension', label: 'Tension', tone: 'warn' }),
]);
export const BUILT_IN_RANGE = Object.freeze({ min: -100, max: 100 });
export const CUSTOM_RANGE = Object.freeze({ min: -1000, max: 1000 });

export const TONES = Object.freeze(['neutral', 'accent', 'good', 'warn', 'bad', 'info']);
