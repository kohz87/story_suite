// Story Director v2: the ctx and view handed to each part (with a memoising query for one prompt build).

import { MODULE_ID } from '../parts.js';
import { settingsFor } from '../settings.js';
import { isObject } from '../shared.js';

// The handler ctx a part sees: the host's, with settings() reading the part's own, and `fights`
// (whether a module runs fights, see fightRunner).
export function partCtx(ns, ctx, shared) {
    const own = shared(ns);
    return Object.freeze({ ...ctx, fights: own.env.fights, settings: settingsFor(ns, id => ctx.settings(id), { ...own, query: ctx.query }) });
}

// The view a part's tail, tab or hook sees: the host's, with settings() reading the part's own.
export function partView(ns, view, shared) {
    if (!isObject(view)) return view;
    const base = typeof view.settings === 'function'
        ? id => view.settings(id)
        : id => (id === undefined || id === null || id === MODULE_ID ? view.settings : {});
    const own = shared(ns);
    return Object.freeze({
        ...view, fights: own.env.fights, settings: settingsFor(ns, base, { ...own, query: view.query }),
        // `model.callModel(request)` and `model.chat()`: the host's model call and the chat's messages, for a part that asks a model about the
        // story (the cast's planner); absent where there is no model call.
        ...(own.model ? { model: own.model } : {}),
        // `story.chat()`: the chat's messages, with or without a model call (the cast reads the reply it brought a person into).
        story: own.story,
    });
}

// A view whose `query` answers a question asked again, with the same arguments, from what it answered the first time. For one
// prompt build only (the tail): the state, the settings and the packs cannot change while it runs, so every part and `learn` ask the
// same of the same, and the work (the atlas's world, the scene) is done once. An answer that threw is not kept.
export function memoQueries(view) {
    if (!isObject(view) || typeof view.query !== 'function') return view;
    const answers = new Map();
    const query = (name, args) => {
        let key;
        try { key = `${name}\u0000${JSON.stringify(args) ?? ''}`; } catch { return view.query(name, args); }
        if (answers.has(key)) return answers.get(key);
        const value = view.query(name, args);
        answers.set(key, value);
        return value;
    };
    return Object.freeze({ ...view, query });
}
