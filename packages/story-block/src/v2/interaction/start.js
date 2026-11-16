// The waiting choice of an interaction a module asked to open before the reader's message goes out (`interactionStart`): the record in
// chat metadata, the opening preview, and the hold. Until the old view can choose for any kind, only the allowed kinds may ask.

import { hashText } from '../assist/common.js';
import { readRecord } from '../persist.js';
import { interactionSeed } from './dice.js';

const KEY = 'storySuiteInteraction';
const SETTLE = 'interaction.settle';
// The old view has a chooser for the fight board only (until the scene host, I8): any other kind's answer is dropped with a quiet Problem.
export const START_KINDS = ['story-block/fight'];
// A running check is page-local: a reloaded metadata object cannot still have a call in flight.
const working = new WeakMap();
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const anchorOf = chat => readRecord(chat?.at(-2))?.sid;
const keyOf = message => hashText(String(message?.mes ?? '').trim());

export function pendingStart(meta, chat) {
    const pending = plain(meta?.[KEY]) ? meta[KEY].start : null, last = chat?.at(-1);
    if (!plain(pending) || !last?.is_user || !pending.anchor || pending.anchor !== anchorOf(chat) || pending.message !== keyOf(last)
        || (pending.mode === 'working' && working.get(meta) !== pending)) return null;
    return pending;
}

export function clearStart(meta, expected = null) {
    const box = plain(meta?.[KEY]) ? meta[KEY] : null;
    if (box && box.start && (!expected || box.start === expected)) {
        working.delete(meta);
        delete box.start;
    }
}

function holdStart(meta, chat, value) {
    const last = chat?.at(-1), anchor = anchorOf(chat);
    if (!plain(meta) || !last?.is_user || !anchor || !String(last.mes ?? '').trim()) return null;
    if (!plain(meta[KEY])) meta[KEY] = {};
    const pending = { anchor, message: keyOf(last), mode: 'known', choice: null, ...value };
    meta[KEY].start = pending;
    return pending;
}

/**
 * A module answered `interactionStart: { kindId, title, anchor, message, choices, opening?: { args } }`: check the chat is still the one asked about, preview the
 * opening prelude when the kind has one, record the hold and answer `{ blocked }` for the turn (null: the send goes on as without it).
 * `kindOf(kindId)` → the kind; `anchor` / `message` are what the module asked about (the anchor reply's sid and the reader's message hash).
 */
export function startInteraction({ answer, moduleId, chat, metadata, bus, kindOf, problem, state, allowed = START_KINDS }) {
    const ask = answer?.interactionStart;
    if (!plain(ask) || typeof ask.kindId !== 'string') return null;
    const kind = kindOf(ask.kindId), title = String(kind?.title ?? ask.title ?? 'interaction');
    if (!plain(kind) || !allowed.includes(ask.kindId)) {
        problem({ module: moduleId, code: 'INTERACTION_START', quiet: true, message: `The ${title} cannot be offered yet; the reply went on without it.` });
        return null;
    }
    const last = chat?.at(-1);
    if (!last?.is_user || anchorOf(chat) !== ask.anchor || keyOf(last) !== ask.message) {
        return { blocked: { moduleId, reason: `The chat changed while the ${title} was being prepared.` } };
    }
    const meta = metadata(), anchor = ask.anchor, box = plain(meta?.[KEY]) ? meta[KEY] : null;
    // Already played or being played on this reply (a session, a Send copy, or this very hold): the offer is ignored, so a module that asks again on release cannot hold the send for ever.
    if (box && (box.open?.anchor === anchor || box.send?.anchor === anchor || (box.start?.anchor === anchor && box.start.message === ask.message))) return null;
    const unready = why => { problem({ module: moduleId, code: 'INTERACTION_START', quiet: true, message: `The ${title} could not be prepared (${why}); the reply went on without it.` }); return null; };
    const attempt = Number.isSafeInteger(meta?.[KEY]?.attempts?.[anchor]) ? meta[KEY].attempts[anchor] : 0;
    const record = { kindId: ask.kindId, title, id: `${anchor}:${attempt}:${ask.kindId}`, choices: Array.isArray(ask.choices) ? ask.choices : [] };
    if (typeof kind.opening === 'function') {
        let setup;
        try { setup = kind.open(state, { anchor, seed: interactionSeed(anchor, attempt, ask.kindId), args: structuredClone(ask.opening?.args ?? {}), query: () => undefined })?.setup; } catch { setup = null; }
        if (!plain(setup)) return unready('its opening did not start');
        const id = `${record.id}#open`, seed = interactionSeed(anchor, attempt, `${ask.kindId}#open`);
        const payload = { v: 1, kindId: ask.kindId, version: kind.version, key: `i:${encodeURIComponent(id)}:${encodeURIComponent(anchor)}:0`, id, anchor, seed, offset: 0, setup, steps: [], witness: null, opening: true };
        const preview = bus.run(SETTLE, payload, { cause: 'system', seed });
        if (!preview?.ok) return unready('its opening could not be previewed');
        record.opening = { payload, seed };
        record.result = preview.receipt?.data?.v2?.result;
    }
    if (!holdStart(meta, chat, record)) return null;
    return { blocked: { moduleId, reason: `Choose how to play the waiting ${title}.`, interactionStart: true } };
}
