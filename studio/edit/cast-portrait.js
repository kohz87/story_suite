// The cast editor's portrait group: a person's picture, added or replaced from a picked file and kept beside the pack's JSON (ctx.setPortrait).
// A picture is taken as the game's install takes it (packs/portraits.js): WebP, PNG or JPEG read from its first bytes, at most 10 MB picked;
// one over 150 KB is made smaller with packs/portrait-fit.js (long side at most 1200 px, WebP) and one already that small is kept byte for byte.

import { h } from '../../ui/kit/dom.js';
import { PORTRAIT_LIMITS } from '../../packs/limits.js';
import { FitProblem, MAX_PIXELS, browserImageIo, fitPortrait, imageSize } from '../../packs/portrait-fit.js';
import { sniffImage } from '../../packs/portraits.js';

const kb = bytes => `${Math.max(1, Math.round(bytes / 1024))} KB`;
const mb = bytes => `${Math.round((bytes / 1048576) * 10) / 10} MB`;

/**
 * A picked file's bytes as the pack would keep them. `bytes`: the file; `imageIo`: `bytes → io` (portrait-fit.js; null: no decoder).
 * → `{ ok: true, bytes, type: 'webp' | 'png' | 'jpg' }` or `{ ok: false, refusal }` in words.
 */
export async function fitPicked(bytes, imageIo) {
    if (!(bytes instanceof Uint8Array) || !bytes.length) return { ok: false, refusal: 'The picture is empty.' };
    const limit = typeof imageIo === 'function' ? PORTRAIT_LIMITS.source : PORTRAIT_LIMITS.bytes;
    if (bytes.length > limit) return { ok: false, refusal: `The picture is ${typeof imageIo === 'function' ? mb(bytes.length) : kb(bytes.length)}; a portrait may be picked at up to ${typeof imageIo === 'function' ? mb(limit) : kb(limit)}.` };
    const type = sniffImage(bytes);
    if (!type) return { ok: false, refusal: 'The picture is not a WebP, PNG or JPEG image.' };
    if (bytes.length <= PORTRAIT_LIMITS.bytes) return { ok: true, bytes, type };
    const size = imageSize(bytes, type);
    if (size && size.width * size.height > MAX_PIXELS) return { ok: false, refusal: `The picture has ${size.width} × ${size.height} pixels, too many to make smaller here (at most ${Math.round(MAX_PIXELS / 1e6)} million).` };
    let io;
    try {
        io = imageIo(bytes);
        const out = await fitPortrait(io);
        return { ok: true, bytes: out.bytes, type: out.type };
    } catch (error) {
        return { ok: false, refusal: error instanceof FitProblem ? `The picture ${error.message}.` : `The picture could not be made smaller (${error?.message ?? error}).` };
    } finally {
        try { io?.close?.(); } catch { /* freed anyway */ }
    }
}

// The file name a picture of `type` is kept under: the person's own name when its type matches, else "<id>.<type>" (free among the cast's).
function nameFor(person, list, type) {
    const own = typeof person.portrait === 'string' ? person.portrait : '';
    const same = own.replace(/\.jpeg$/i, '.jpg').toLowerCase().endsWith(`.${type}`);
    if (own && same) return own;
    const taken = new Set(list.filter(other => other !== person).map(other => other?.portrait));
    const base = String(person.id ?? 'person').slice(0, 50);
    let name = `${base}.${type}`;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}.${type}`;
    return name;
}

/**
 * The portrait group for `person` (at `where`, one of `list`). `kit`: `{ ctx, commit(patches) → result, tell(text), imageIo? }`
 * (`imageIo` defaults to the browser's). Picking a file stores it with ctx.setPortrait and, when the name changes, writes `portrait`;
 * the old picture leaves when no one else names it. Remove takes the field and, if unshared, the picture.
 */
export function portraitGroup(person, where, list, kit) {
    const { ctx, commit, tell } = kit;
    const own = typeof person.portrait === 'string' ? person.portrait : null;
    const shared = name => list.some(other => other !== person && other?.portrait === name);
    const status = h('small', { class: 'fine st-picnote', role: 'status' });
    const input = h('input', { type: 'file', accept: 'image/webp,image/png,image/jpeg', class: 'st-picfile', 'aria-label': `Pick a portrait for ${person.name ?? person.id ?? 'this person'}`, hidden: true });
    const take = async () => {
        const file = input.files?.[0];
        if (!file) return null;
        status.textContent = 'Reading the picture…';
        let bytes;
        try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { status.textContent = ''; return tell('The picture could not be read.'); }
        const fit = await fitPicked(bytes, kit.imageIo === undefined ? browserImageIo(globalThis) : kit.imageIo);
        status.textContent = '';
        if (!fit.ok) return tell(fit.refusal);
        const name = nameFor(person, list, fit.type);
        const stored = ctx.setPortrait?.(name, fit.bytes);
        if (!stored?.ok) return tell(stored?.refusal ?? 'The picture was not kept.');
        if (name !== own) {
            const result = commit([{ op: 'set', path: [...where, 'portrait'], value: name }]);
            if (result?.ok && own && !shared(own)) ctx.setPortrait?.(own, null);
        }
        tell(fit.bytes.length < bytes.length ? `Made smaller to fit: ${kb(fit.bytes.length)} (was ${kb(bytes.length)}).` : '');
        return name;
    };
    // `kit.pending` holds the running read, so a caller (a test) can wait for it.
    input.addEventListener('change', () => { kit.pending = take(); });
    const remove = () => {
        if (!own) return;
        if (commit([{ op: 'remove', path: [...where, 'portrait'] }])?.ok && !shared(own)) ctx.setPortrait?.(own, null);
    };
    const thumb = own ? ctx.portrait?.(own) ?? null : null;
    return h('section', { class: 'sgrp st-portrait', dataset: { key: 'portrait' } }, h('div', { class: 'gt' }, 'Portrait'),
        h('div', { class: 'srow' },
            h('span', { class: 'lb' }, thumb, h('b', own ?? 'No portrait'),
                h('small', `WebP, PNG or JPEG. A picture over ${kb(PORTRAIT_LIMITS.bytes)} is made smaller, as the game does when it installs the pack`)),
            h('span', { class: 'ctl' }, input,
                h('button', { type: 'button', class: 'btn2 st-picadd', onClick: () => input.click() }, own ? 'Replace' : 'Add a portrait'),
                own ? h('button', { type: 'button', class: 'btn2 dng st-picdel', onClick: remove }, 'Remove') : null)),
        status);
}
