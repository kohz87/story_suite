// The built-in Gregorian calendar and the plain-record check the calendar code shares.

export const GREGORIAN = Object.freeze({
    era: '',
    leapYears: true,
    months: Object.freeze([
        ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
        ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
    ].map(([name, days]) => Object.freeze({ name, days }))),
});

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
