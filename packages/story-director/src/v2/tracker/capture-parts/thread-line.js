// Story Director v2, tracker part: applies a story-told thread line (`+ ~ - !`) to the director draft.

import { lineKey } from '../../../changes.js';
import { applyOps } from '../../../tracker.js';
import { orderedThreads, toTracker } from '../convert.js';
import { addProblem, turnNumber } from '../domain.js';
import { acceptIntent } from '../acceptance.js';
import { threadWriteId } from '../thread-writes.js';
import { agendaProgress, placeNamed, pulseActive } from '../../pulse/effects.js';
import { KEY_CHARS, MAX_OPEN_THREADS, NEW_THREADS_PER_REPLY, SUMMARY_CHARS } from './limits.js';
import { beginTurn, readerSaid } from './reply.js';
import { capSummary, lineText } from './text.js';
import { droppedProblem, toV1Op, withoutDroppedLabels } from './reading.js';
import { newId, writeBack } from './thread-store.js';
import { recordStep } from './step-trail.js';

// Problems are the domain's (domain.js addProblem: each under its own key, never a list position).
export { addProblem };

const withArticle = word => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;

// Story-told thread progress uses the retained tracker.
const rulesOn = (tracker, ops, director, said) => applyOps(tracker, ops, { message: turnNumber(director), time: director.time.minutes, said: null, direct: false });

export function applyThreadLine(ctx, given) {
    return threadLine(ctx, given);
}

function threadLine(ctx, given) {
    const director = ctx.draft('director');
    const turn = beginTurn(director, ctx, given);
    const raw = lineText(given);
    // Labels the Director does not keep are left out first (a Problem says which).
    const { line: kept, dropped } = withoutDroppedLabels(given);
    if (dropped.length) addProblem(director, ctx, droppedProblem(given, dropped));
    // A quest line's own labels (F83 `met:`, F85 `progress:`) are taken out before v1 reads it.
    const line = kept;
    const read = toV1Op(line);
    if (read.error) {
        addProblem(director, ctx, { kind: 'unread', severity: 'warn', key: String(line?.name ?? ''), op: line?.op, text: read.error });
        return { summary: `Director: ${raw} (not used)`, narrate: false, data: { thread: null, problems: ['unread'] } };
    }
    const op = read.op;
    if (read.cut) addProblem(director, ctx, { kind: 'long-name', severity: 'info', key: op.key, op: op.op, text: `A name ${read.cut} characters long was cut to "${op.key}" (names are at most ${KEY_CHARS}).` });
    const said = readerSaid(ctx);
    const tracker = toTracker(director);
    tracker.records = tracker.records.filter(record => {
        const thread = director.threads[director.keys[record.id]];
        return thread && !thread.rpg;
    });
    // Each record as read (the same objects come back from the rules, changed or not: so plain JSON).
    const asRead = new Map(tracker.records.map(record => [record.id, JSON.stringify(record)]));
    const ops = [op];
    const named = director.threads[director.keys[op.id]];
    const stepBefore = String(named?.fields?.step ?? '').trim();
    if (named?.rpg || named?.owed || named?.ready) {
        return { summary: 'Quest from an earlier version (read only).', narrate: false, data: { thread: named.id } };
    }
    if (!named && line.op === '+' && line.kind === 'hook' && line.labels?.goal) {
        const id = newId(ctx, new Set(Object.keys(director.threads)));
        ctx.call('threads.offer', { write: threadWriteId(ctx, `offer:${id}`), thread: id, kind: 'hook', key: op.key,
            summary: capSummary(line.text ?? ''), fields: Object.fromEntries(Object.entries(line.labels ?? {}).filter(([key]) => ['goal', 'giver', 'step', 'progress', 'due', 'place', 'people', 'now', 'then', 'on', 'type', 'reward', 'difficulty'].includes(key))), expectedHash: null });
        return { summary: `Director: ${raw}`, narrate: false, data: { thread: id } };
    }
    if (named?.offer) acceptIntent(ctx, named);
    const result = rulesOn(tracker, ops, director, said);
    const findings = result.problems;
    const records = result.tracker.records;
    for (const record of records) {
        if (record.id === op.id && line.kind === 'quest') record.kind = 'quest';
        else if (record.kind === 'quest') record.kind = director.threads[director.keys[record.id]]?.kind ?? line.kind;
    }
    // One reply adds at most NEW_THREADS_PER_REPLY threads, and at most MAX_OPEN_THREADS are open at
    // once: past either, a line that would add one is not used.
    const known = new Set(orderedThreads(director).map(thread => lineKey(thread.key)));
    const adding = records.filter(record => !known.has(record.id)).length;
    if (adding > 0) {
        const open = Object.values(director.threads).filter(thread => thread?.status === 'active').length;
        const full = turn.added + adding > NEW_THREADS_PER_REPLY ? `one reply adds at most ${NEW_THREADS_PER_REPLY} new threads`
            : open + adding > MAX_OPEN_THREADS ? `the Director follows at most ${MAX_OPEN_THREADS} open threads; close or finish some first` : '';
        if (full) {
            addProblem(director, ctx, { kind: 'too-many', severity: 'warn', key: op.key, op: op.op, text: `"${op.key}" was not added: ${full}.` });
            return { summary: `Director: ${raw} (not used)`, narrate: false, data: { thread: null, problems: ['too-many'] } };
        }
        turn.added += adding;
    }

    // A `~` on a name not tracked becomes v1's hook (or, with a giver or reward, its quest); the
    // line's own kind says what it is, so only `~ quest` makes a quest of it.
    const added = findings.find(finding => finding.kind === 'untracked-added');
    if (added && line.kind !== 'quest') {
        const record = records.find(entry => entry.id === op.id);
        if ((record?.kind === 'hook' || record?.kind === 'quest') && record.kind !== line.kind) {
            record.kind = line.kind;
            added.message = `"${op.key}" was not tracked; added as ${withArticle(line.kind)}.`;
        }
    }
    const reached = record => record.id === op.id || (record.aliases ?? []).includes(op.id);
    // A summary (v1's `desc`) longer than SUMMARY_CHARS is cut, with a Problem.
    for (const record of records) {
        const desc = String(record.fields?.desc ?? '');
        if (desc.length <= SUMMARY_CHARS) continue;
        record.fields.desc = capSummary(desc);
        addProblem(director, ctx, { kind: 'long-summary', severity: 'info', key: record.key, op: op.op, text: `The summary of "${record.key}" was ${desc.length} characters long; it was cut to ${SUMMARY_CHARS}.` });
    }
    const idOf = writeBack(director, records, ctx, asRead);
    const target = records.find(reached);
    const thread = target ? idOf.get(target.id) : null;
    for (const finding of findings) {
        addProblem(director, ctx, {
            kind: finding.kind, severity: finding.severity, key: finding.key ?? undefined, op: finding.op ?? op.op,
            text: finding.message, candidates: finding.candidates,
        });
    }
    const current = thread ? director.threads[thread] : null;
    if (current && current.status === 'active') recordStep(director, ctx, current, stepBefore);
    // An agenda's step progress and place (feature `story-director.pulse`): optional fields the pulse reads, written by code, never the story's.
    if (current?.kind === 'agenda' && current.status === 'active' && pulseActive(ctx)) {
        const patch = agendaProgress(named?.fields ?? null, current.fields ?? {}, { minutes: director.time.minutes, where: placeNamed(ctx.query, current.fields?.now) });
        if (patch) current.fields = { ...current.fields, ...patch };
    }
    if (named?.acceptance && named.status === 'active' && current?.status === 'resolved') {
        ctx.call('chronicle.threadOutcome', { thread, text: `${current.key}: ${current.ended.outcome}.` });
    }
    return { summary: `Director: ${raw}`, narrate: false, data: { thread, problems: findings.map(finding => finding.kind) } };
}
