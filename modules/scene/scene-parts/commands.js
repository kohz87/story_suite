// The scene's commands: place, present, weather and {{user}}'s look. Pure.

import { WEATHER_FEATURE, YOU_FEATURE } from '../constants.js';
import { markEdit } from '../shared.js';
import { changePresent, setPresent } from '../present.js';
import { setPlace } from '../place.js';
import { setWeather } from '../weather.js';
import { setYou } from '../you.js';

export const sceneCommands = {
    // { name, kind?, region?, with?: name | name[] } (a move leaves behind everyone not named in `with`)
    'scene.place': (ctx, payload = {}) => markEdit(ctx, setPlace(ctx, payload)),
    // { add?: name | name[], remove?: name | name[] }
    'scene.present': (ctx, payload = {}) => markEdit(ctx, payload.set === undefined ? changePresent(ctx, payload) : setPresent(ctx, payload.set)),
    // { text?, key? } (a module's rule; the story writes `~ weather`)
    'scene.weather': Object.assign((ctx, payload = {}) => markEdit(ctx, setWeather(ctx, payload)), { feature: WEATHER_FEATURE }),
    // { rank?, wearing?, condition? } ('' clears a part; the story writes `~ you`)
    'scene.you': Object.assign((ctx, payload = {}) => markEdit(ctx, setYou(ctx, payload)), { feature: YOU_FEATURE }),
};
