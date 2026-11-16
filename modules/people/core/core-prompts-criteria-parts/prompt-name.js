/* Flattens persona and character names onto one line of at most PROMPT_NAME_MAX code points for the prompts. */
// The persona's and the character's names as the prompts write them: on one line and at most
// PROMPT_NAME_MAX characters (code points, so a pair is never split), as Story Block writes
// {{user}} and {{char}}. A name with no line break, control character or excess length comes back
// exactly as given, so ordinary prompts are byte-identical; a name that flattens to nothing gives
// `fallback`. Anything but a string is returned as it is (the builders' defaults then apply).
export const PROMPT_NAME_MAX = 80;
export function flatPromptName(value, fallback = '') {
    if (typeof value !== 'string') return value;
    let name = value;
    if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(name)) name = name.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').replace(/ {2,}/g, ' ').trim();
    const points = Array.from(name);
    if (points.length > PROMPT_NAME_MAX) name = `${points.slice(0, PROMPT_NAME_MAX - 1).join('').trimEnd()}…`;
    return name || fallback;
}
