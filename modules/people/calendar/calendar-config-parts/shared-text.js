/* Shared calendar text and integer cleaners used by month parsing, normalization and the date parts. */

export function cleanText(value, max = 120) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normalizeMonthKey(value) {
    return cleanText(value, 80).normalize('NFKC').toLocaleLowerCase();
}

export function parseInteger(value) {
    const text = String(value ?? '').trim();
    if (!/^-?\d{1,7}$/.test(text)) return null;
    const number = Number(text);
    return Number.isSafeInteger(number) && Math.abs(number) <= 999999 ? number : null;
}
