// The scene's weather: `~ weather cold drizzle, low fog` (the story's words, kept as they are) and the `scene.weather` command a reader's
// edit (or a module) sets it with. Descriptive only; no mechanics read it. Pure.

import { cutPoints, flatten } from './extras.js';
import { lineBody } from '../../core/capture.js';
import { WEATHER_CHARS } from './constants.js';
import { HAS_WORD } from './shared.js';

/**
 * `scene.weather({ text })`: the weather now, set by a reader's edit (cause `ui`) or a module (cause `system`), never the story (it
 * writes `~ weather`). The text is cleaned as a `~ weather` line is and kept as `{ text, rev }`; the same text again changes nothing.
 */
export function setWeather(ctx, { text } = {}) {
    if (ctx.cause === 'story') ctx.fail('REFUSED', 'The story writes the weather with a ~ weather line.');
    if (typeof text !== 'string') ctx.fail('INVALID', 'The weather must be text.');
    const clean = weatherText(`~ weather ${text}`);
    if (!clean) ctx.fail('INVALID', 'The weather has no words.');
    const scene = ctx.draft('scene');
    if (scene.weather?.text === clean) return { summary: `The weather stays: ${clean}.`, data: { text: clean, same: true }, narrate: false };
    scene.weather = { text: clean, rev: Number.isSafeInteger(ctx.rev) ? ctx.rev : 0 };
    return { summary: `The weather: ${clean}.`, data: { text: clean }, narrate: false };
}

// A weather text as stored: the line's words (markdown and decoration gone), tags and anything inside
// `<…>` out (never markup), one plain line, cut by code points.
export function weatherText(raw) {
    const text = flatten(lineBody(String(raw ?? '')).replace(/<[^>]*>?/g, ' ').replace(/[<>]/g, ' '));
    return HAS_WORD.test(text) ? cutPoints(text, WEATHER_CHARS) : '';
}

/**
 * `~ weather cold drizzle, low fog` (or `+ weather`): the weather now, descriptive only (no mechanics read
 * it). Kept as `scene.weather = { text, rev }` (`rev`: the meta.rev of the receipt that wrote it). The same
 * text again changes nothing. `weather` is one of the scene's `scratch` fields, so a later reply's write
 * replays whole after the reply that first wrote a weather is deleted (SPEC §2.2).
 */
export function captureWeather(ctx, line) {
    if (line?.op !== '~' && line?.op !== '+') {
        ctx.fail('INVALID', `"${line?.op} weather" is not a change the scene understands; use ~ weather and a few words.`);
    }
    const text = weatherText(line?.raw ?? `${line?.op ?? '~'} weather ${line?.text ?? line?.name ?? ''}`);
    if (!text) ctx.fail('INVALID', 'The weather line has no words (write "~ weather cold drizzle, low fog").');
    const scene = ctx.draft('scene');
    if (scene.weather?.text === text) return { summary: `The weather stays: ${text}.`, data: { text, same: true }, narrate: false };
    scene.weather = { text, rev: Number.isSafeInteger(ctx.rev) ? ctx.rev : 0 };
    return { summary: `The weather: ${text}.`, data: { text }, narrate: false };
}
