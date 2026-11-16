/* NPC State Delta identity: age wording shared by the age normalizers: cleaned text, number words, unknown placeholders. */
import { cleanText } from '../core-text.js';

export function normalizedAgeText(value) {
    return cleanText(value, 80).toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

const AGE_ONES = Object.freeze({
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19,
});
const AGE_TENS = Object.freeze({ twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 });
export const AGE_NUMBER_WORD_RE = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|thirty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|forty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|fifty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|sixty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|seventy(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|eighty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|ninety(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|one hundred(?: and)?(?:[- ](?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|thirty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|forty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|fifty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|sixty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|seventy(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|eighty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|ninety(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))))?)';

export function parseEnglishAgeNumber(value) {
    let text = normalizedAgeText(value).replace(/-/g, ' ').replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    if (/^\d{1,3}$/.test(text)) {
        const number = Number(text);
        return number >= 0 && number <= 200 ? number : null;
    }
    if (Object.prototype.hasOwnProperty.call(AGE_ONES, text)) return AGE_ONES[text];
    const parts = text.split(' ').filter(Boolean);
    let total = 0;
    let used = false;
    for (const part of parts) {
        if (part === 'hundred') {
            if (!used || total < 1 || total > 9) return null;
            total *= 100;
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(AGE_ONES, part)) {
            total += AGE_ONES[part]; used = true; continue;
        }
        if (Object.prototype.hasOwnProperty.call(AGE_TENS, part)) {
            total += AGE_TENS[part]; used = true; continue;
        }
        return null;
    }
    return used && total >= 0 && total <= 200 ? total : null;
}

export function isUnknownAgePlaceholder(value) {
    const lower = normalizedAgeText(value);
    return !lower || /^(?:unknown|unk|n\/?a|none|unspecified|not\s+(?:known|established|specified|stated)|unclear|not\s+available)$/i.test(lower);
}
