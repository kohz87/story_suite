// Small number readers shared by the board's member and chip builders.

export const memberValue = member => {
    const value = Number(member?.value ?? member?.hurt);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
};

export const sumOf = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
export const whole = value => Math.max(0, Math.trunc(Number(value)) || 0);
