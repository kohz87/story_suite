// The select-style choice fields: a plain select and the Connection Manager profile select.

import { optionsOf } from '../../schema.js';
import { profileChoices } from '../../../../../../../../core/model-call/profile-field.js';
import { h, named, setDisabled } from '../shared.js';

// ---- select and profile ----------------------------------------------------------------------------

function fillSelect(doc, select, options) {
    select.replaceChildren();
    for (const option of options) {
        const node = h(doc, 'option', '', option.label);
        node.value = option.value;
        select.appendChild(node);
    }
}

export function selectField(ctx) {
    const { doc, field } = ctx;
    const select = h(doc, 'select', 'ss-input ss-select');
    named(select, ctx);
    fillSelect(doc, select, optionsOf(field));
    select.value = String(ctx.value ?? '');
    let off = false;
    let locked = false;
    select.addEventListener('change', () => ctx.onChange(select.value, { typed: select.value }));
    const handle = {
        el: select, input: select,
        get: () => select.value,
        set(value) { select.value = String(value ?? ''); },
        setDisabled(value) { off = Boolean(value); setDisabled(select, off || locked); },
        setReadOnly(value) { locked = Boolean(value); setDisabled(select, locked || off); },
        destroy() {},
    };
    handle.setDisabled(Boolean(ctx.disabled));
    handle.setReadOnly(Boolean(ctx.readOnly));
    return handle;
}

/**
 * The Connection Manager profile select (profile-field.js's choices: "Same as chat", then the profiles by name; a
 * stored name that is gone stays as "… (not found)"), with its note ("There are no connection profiles yet…")
 * handed to `ctx.note`. `ctx.profiles()` answers listProfiles()'s shape (the page's by default).
 */
export function profileField(ctx) {
    const { doc } = ctx;
    const select = h(doc, 'select', 'ss-input ss-select ss-profile');
    named(select, ctx);
    let off = false;
    let locked = false;
    // With nothing to pick but "Same as chat" (no Connection Manager, or no profiles in it) the select is disabled, and the
    // note under the label says why; a stored profile that is gone still shows (as "not found") and can be changed.
    let nothing = false;
    const lock = () => setDisabled(select, off || locked || nothing);
    const draw = value => {
        const list = typeof ctx.profiles === 'function' ? ctx.profiles() : undefined;
        const { options, selected, note } = list === undefined ? profileChoices(value) : profileChoices(value, list);
        fillSelect(doc, select, options);
        select.value = selected;
        nothing = options.length <= 1;
        lock();
        ctx.note?.(note);
    };
    draw(ctx.value);
    select.addEventListener('change', () => ctx.onChange(select.value, { typed: select.value }));
    const handle = {
        el: select, input: select,
        get: () => select.value,
        set(value) { draw(value); },
        setDisabled(value) { off = Boolean(value); lock(); },
        setReadOnly(value) { locked = Boolean(value); lock(); },
        destroy() {},
    };
    handle.setDisabled(Boolean(ctx.disabled));
    handle.setReadOnly(Boolean(ctx.readOnly));
    return handle;
}
