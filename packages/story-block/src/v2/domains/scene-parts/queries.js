// The scene's queries: place, present, weather and {{user}}'s look. Pure.

import { WEATHER_FEATURE, YOU_FEATURE } from '../scene/constants.js';
import { rankLabelIn, wornWords } from '../scene/you.js';
import { initialScene } from './state.js';

export const sceneQueries = {
    'scene.place': state => ({ ...(state?.domains?.scene?.place ?? initialScene().place) }),
    'scene.present': state => [...(state?.domains?.scene?.present ?? [])],
    // The weather now, `{ text }`, or null when no reply wrote one (and while `story-block.weather` is off).
    'scene.weather': Object.assign(state => {
        const text = state?.domains?.scene?.weather?.text;
        return typeof text === 'string' && text ? { text } : null;
    }, { feature: WEATHER_FEATURE }),
    // What {{user}} wears and their condition, `{ wearing, condition, position }` ('' for a wearing or condition no reply said, no `position` key until one is set; null while `story-block.you` is off).
    // With a pack that gives a Rank (`packs.youRank`), also `rank` and `rankLabel` (the pack's word for it); without one the stored rank is
    // kept but not answered.
    'scene.you': Object.assign((state, _args, tools) => {
        const you = state?.domains?.scene?.you;
        const text = part => (typeof you?.[part] === 'string' ? you[part] : '');
        const label = typeof tools?.query === 'function' ? rankLabelIn(tools.query) : '';
        // With gear on (B1.4) also `outfit` and `look` once set, and `gear`: the words for what is equipped.
        const extra = Object.fromEntries([['outfit', text('outfit')], ['look', text('look')], ['gear', wornWords(state)]].filter(([, words]) => words));
        return { ...(label ? { rank: text('rank'), rankLabel: label } : {}), wearing: text('wearing'), condition: text('condition'), ...extra, ...(text('position') ? { position: text('position') } : {}) };
    }, { feature: YOU_FEATURE }),
};
