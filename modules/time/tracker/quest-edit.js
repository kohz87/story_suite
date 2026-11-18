// The reader's own changes to a quest in the Journal: Edit (`quest.edit`), Give up (`quest.giveup`) and Delete (`quest.delete`), as commands on the director slice.

import { lineKey } from '../../world/changes.js';

const OPEN = thread => thread && thread.status === 'active' && !thread.offer && !thread.rpg && !thread.owed && !thread.ready;
const clip = (value, room) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, room);
const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);

// `closed`: a quest the story or the reader has closed (done, failed, given up) may be taken off the Journal too.
function questOf(ctx, payload, { closed = false } = {}) {
    const director = ctx.draft('director');
    const thread = director.threads?.[payload?.id];
    const shut = closed && thread?.status === 'resolved' && thread.kind === 'quest';
    if (!shut && (!OPEN(thread) || thread.kind !== 'quest')) ctx.fail('REFUSED', 'That quest is not open.');
    return { director, thread };
}

// A field that is blank is cleared (the reader emptied the box).
function setField(fields, name, value) {
    if (value) fields[name] = value;
    else delete fields[name];
}

/** `quest.edit { id, patch: { title?, summary?, stepIndex?, due?, reward?, difficulty? } }`. */
export function questEdit(ctx, payload = {}) {
    const { director, thread } = questOf(ctx, payload);
    const patch = payload.patch && typeof payload.patch === 'object' ? payload.patch : {};
    const fields = { ...(thread.fields ?? {}) };
    if (Object.hasOwn(patch, 'title')) {
        const title = clip(patch.title, 120);
        const key = lineKey(title);
        if (!title || !key) ctx.fail('INVALID', 'A quest needs a title.');
        const holder = director.keys[key];
        if (holder && holder !== thread.id && director.threads[holder]?.status === 'active') ctx.fail('CONFLICT', 'Another open thread already has that title.');
        if (key !== lineKey(thread.key)) {
            if (director.keys[lineKey(thread.key)] === thread.id) delete director.keys[lineKey(thread.key)];
            director.keys[key] = thread.id;
        }
        thread.key = title;
    }
    if (Object.hasOwn(patch, 'summary')) thread.summary = clip(patch.summary, 600);
    if (Object.hasOwn(patch, 'due')) setField(fields, 'due', clip(patch.due, 80));
    if (Object.hasOwn(patch, 'reward')) setField(fields, 'reward', clip(patch.reward, 200));
    if (Object.hasOwn(patch, 'difficulty')) {
        if (!DIFFICULTIES.has(patch.difficulty)) ctx.fail('INVALID', 'Difficulty is easy, normal or hard.');
        fields.difficulty = patch.difficulty;
    }
    if (Object.hasOwn(patch, 'stepIndex')) {
        const board = ctx.query('quest.board', {})?.active?.find(row => row.id === thread.id);
        const step = board?.steps?.[patch.stepIndex];
        if (!Number.isInteger(patch.stepIndex) || typeof step !== 'string') ctx.fail('INVALID', 'That step is not on this quest.');
        fields.step = clip(step, 600);
    }
    thread.fields = fields;
    thread.rev = ctx.rev;
    return { summary: `Quest edited: ${thread.key}.`, narrate: false, data: { thread: thread.id } };
}

/** `quest.giveup { id }`: the quest closes as given up (the Journal's Closed card says so). */
export function questGiveUp(ctx, payload = {}) {
    const { director, thread } = questOf(ctx, payload);
    const turn = director.turn?.n ?? 0;
    thread.status = 'resolved';
    thread.ended = { rev: ctx.rev, at: ctx.time(), reason: 'given up', outcome: 'abandoned' };
    thread.track = { ...(thread.track ?? {}), closed: { turn, time: ctx.time() } };
    thread.rev = ctx.rev;
    return { summary: `Quest given up: ${thread.key}.`, narrate: false, data: { thread: thread.id } };
}

/** `quest.delete { id }`: the quest and its step trail are gone, as if the story never offered it. */
export function questDelete(ctx, payload = {}) {
    const { director, thread } = questOf(ctx, payload, { closed: true });
    for (const [name, id] of Object.entries(director.keys)) if (id === thread.id) delete director.keys[name];
    for (const [name, step] of Object.entries(director.steps ?? {})) if (step?.thread === thread.id) delete director.steps[name];
    delete director.threads[thread.id];
    return { summary: `Quest deleted: ${thread.key}.`, narrate: false, data: { thread: thread.id } };
}

export const questCommands = Object.freeze({ 'quest.edit': questEdit, 'quest.giveup': questGiveUp, 'quest.delete': questDelete });
