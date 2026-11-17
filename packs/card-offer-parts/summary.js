// The offer's plain-language summaries: what a pack brings, and what an install did to the settings.

import { joinWords, plural } from './shared-words.js';

const SHOWN_KINDS = [['places', 'places'], ['cast', 'cast'], ['items', 'items'], ['events', 'events'], ['foes', 'foes'],
    ['routes', 'routes'], ['skills', 'skills']];

/** What a pack brings, in a few words: "places, cast, items, 12 portraits" (or "adds Reputation" for data modules alone). */
export function bringsLine(pack, portraits = 0) {
    const content = pack.content ?? {};
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
