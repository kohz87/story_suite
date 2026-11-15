// Formatters: the plain money and time fallbacks a scope uses until the host injects real ones.

/** Plain fallbacks; the host injects the real ones (the rules' coin names, the Director's calendar). */
export const defaultFormatters = {
    money: n => (Number.isInteger(n) ? String(n) : ''),
    time: minutes => {
        if (!Number.isInteger(minutes) || minutes < 0) return '';
        const day = Math.floor(minutes / 1440) + 1;
        const hour = Math.floor((minutes % 1440) / 60);
        const minute = minutes % 60;
        return `Day ${day}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    },
};
