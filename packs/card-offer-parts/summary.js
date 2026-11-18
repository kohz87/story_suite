// The offer's plain-language summaries: what a pack brings, and what an install did to the settings.

import { joinWords, plural } from './shared-words.js';

const SHOWN_KINDS = [['places', 'places'], ['cast', 'cast'], ['items', 'items'], ['events', 'events'], ['foes', 'foes'],
    ['routes', 'routes'], ['skills', 'skills']];

// What a format 4 game pack changes in the settings, in the order shown.
const GAME_PARTS = [['calendar', 'a calendar'], ['currency', 'money'], ['economy', 'a price scale'], ['weather', 'weather'], ['start', 'a start']];

/** What a pack brings, in a few words: "places, cast, items, 12 portraits" (or "adds Reputation" for data modules alone; a game pack: "a calendar, money"). */
export function bringsLine(pack, portraits = 0) {
    const content = pack.content ?? {};
    if (pack.kind === 'game') {
        const sections = GAME_PARTS.filter(([key]) => pack[key]).map(([, word]) => word);
        if (Array.isArray(content.dataModules) && content.dataModules.length) sections.push(plural(content.dataModules.length, 'data module'));
        return sections.slice(0, 3).join(', ');
    }
    const parts = SHOWN_KINDS.filter(([kind]) => Array.isArray(content[kind]) && content[kind].length).slice(0, 3).map(([, word]) => word);
    const modules = Array.isArray(content.dataModules) ? content.dataModules : [];
    const named = modules.slice(0, 3).map(module => String(module?.name ?? '')).filter(Boolean);
    const head = parts.length ? parts.join(', ') : modules.length ? `adds ${named.length ? joinWords(named) : plural(modules.length, 'data module')}` : '';
    return [head, portraits ? plural(portraits, 'portrait') : ''].filter(Boolean).join(', ');
}

/** What an install did to the settings, in words: "RPG and Gear are on; NSD portraits set to Natural." */
export function settingsDone(applied) {
    const parts = [];
    for (const state of ['on', 'off']) {
        const labels = applied.filter(item => item.text === `${item.label} ${state}`).map(item => item.label);
        if (labels.length) parts.push(`${joinWords(labels)} ${labels.length === 1 ? 'is' : 'are'} ${state}`);
    }
    for (const item of applied) {
        if (item.text === `${item.label} on` || item.text === `${item.label} off`) continue;
        parts.push(`${item.label} set to ${item.text.slice(item.label.length + 1)}`);
    }
    return parts.length ? `${parts.join('; ')}.` : '';
}
