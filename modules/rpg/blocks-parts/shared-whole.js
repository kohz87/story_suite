// The whole-number reader shared by the bar helpers.

export const whole = value => (Number.isSafeInteger(value) ? value : 0);
