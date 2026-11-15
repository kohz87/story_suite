// Building the whole report as text, section by section.
import { promptSize } from '../host-ui.js';
import { PROBLEMS_SHOWN, HOOK_TIMEOUT_MS, LIST_MAX } from './limits.js';
import { scrubLine } from './secrets.js';
import { scrubSettings } from './scrub-settings.js';
import { yes, num, sizeText } from './shared-format.js';
import { chatCounts } from './chat-counts.js';
import { hookLines, withLimit } from './hooks.js';
import { callsLine } from './calls-line.js';

/**
 * The report, as text. `source` (every part optional; a part that throws is named, the rest goes on):
 *   stVersion?() → text (or a promise), hostVersion, modules?() → [{ id, name, version }], refusals?(),
 *   features?() → [{ id, on, available }], settingsOf?(moduleId) → values, hostSettings?() → values,
 *   promptParts?() → parts or { parts, fit } (as the prompt size panel), tailBudget?,
 *   problems?() → [{ module, code, message, index, line }], save?() → { failing, dirty, suspect, pending },
 *   calls?() → the model-call queue's stats (callsLine),
 *   caught?() → caughtSoFar(), chat?() → the chat array, chatOpen?() → boolean,
 *   hooks?() → [{ moduleId, fn }] (each module's `hooks.diagnostics`), now?() → a Date (the stamp only).
 * → Promise<string>.
 */
export async function buildReport(source = {}) {
    const out = [];
    const section = title => { out.push('', `== ${title} ==`); };
    const tryPart = (title, run) => {
        try { run(); } catch (error) { out.push(`(${title} could not be read: ${scrubLine(error?.message ?? error, 160)})`); }
    };
    const stamp = (() => { try { return (source.now?.() ?? new Date()).toISOString(); } catch { return ''; } })();
    out.push('Story Suite diagnostics', stamp ? `Made ${stamp}` : '');

    section('Versions');
    let st = '';
    try { st = String(await source.stVersion?.() ?? ''); } catch { st = ''; }
    out.push(`SillyTavern: ${scrubLine(st || 'unknown', 120)}`);
    out.push(`Story Block: ${scrubLine(source.hostVersion ?? 'unknown', 60)}`);
    const modules = (() => { try { return source.modules?.() ?? []; } catch { return []; } })();
    tryPart('the modules', () => {
        for (const module of modules) {
            if (module?.id === 'story-block') continue;
            out.push(`${scrubLine(module?.name ?? module?.id, 60)} (${scrubLine(module?.id, 60)}): ${scrubLine(module?.version ?? 'unknown', 40)}`);
        }
        for (const refusal of source.refusals?.() ?? []) out.push(`Not loaded: ${scrubLine(refusal?.id ?? refusal?.moduleId ?? '?', 60)}: ${scrubLine(refusal?.reason ?? refusal?.message ?? '', 200)}`);
    });

    section('Features');
    tryPart('the features', () => {
        const list = source.features?.() ?? [];
        const on = list.filter(feature => feature?.on === true && feature.available !== false);
        out.push(`${on.length} of ${list.length} on.`);
        if (on.length) out.push(`On: ${on.map(feature => feature.id).join(', ')}`);
        const off = list.filter(feature => !(feature?.on === true && feature.available !== false));
        if (off.length) out.push(`Off: ${off.map(feature => `${feature.id}${feature.available === false ? ' (unavailable)' : ''}`).join(', ')}`);
    });

    section('Settings');
    out.push('Keys that name a key, token, password, address or other secret are left out.');
    tryPart('Story Suite\'s settings', () => {
        const removed = [];
        out.push(`Story Suite: ${JSON.stringify(scrubSettings(source.hostSettings?.() ?? {}, removed))}`);
        if (removed.length) out.push(`  left out: ${removed.join(', ')}`);
    });
    for (const module of modules) {
        tryPart(`${module?.id}'s settings`, () => {
            const removed = [];
            const values = scrubSettings(source.settingsOf?.(module.id) ?? {}, removed);
            out.push(`${module.id}: ${JSON.stringify(values)}`);
            if (removed.length) out.push(`  left out: ${removed.join(', ')}`);
        });
    }

    section('Prompt size');
    tryPart('the prompt size', () => {
        const got = source.promptParts?.();
        const parts = Array.isArray(got) ? got : got?.parts;
        const fit = Array.isArray(got) ? null : got?.fit ?? null;
        if (!Array.isArray(parts)) { out.push('No chat open (nothing to count).'); return; }
        const budget = Number.isInteger(fit?.budget) ? fit.budget : Number.isInteger(source.tailBudget) ? source.tailBudget : undefined;
        const size = promptSize(parts, budget ? { budget } : {});
        out.push(`Estimated at four characters a token. Instructions: ${num(size.static)}. This reply's part: ${num(size.tail)} of ${num(size.budget)}. In all: ${num(size.total)}.`);
        for (const row of size.modules) out.push(`  ${scrubLine(row.id, 60)}: instructions ${num(row.static)}, this reply ${num(row.tail)}`);
        if (fit) out.push(`Context size: ${num(fit.size)} tokens${fit.reply ? ` (${num(fit.reply)} for the reply)` : ''}. Story Suite's share: ${num(fit.share)} of ${num(fit.room)} (${fit.percent}%)${fit.tooSmall ? '; the context is too small' : ''}.`);
        else out.push('Context size: shown after the next reply.');
    });

    section(`Problems (the last ${PROBLEMS_SHOWN})`);
    tryPart('the problems', () => {
        const list = (source.problems?.() ?? []).slice(-PROBLEMS_SHOWN);
        if (!list.length) out.push('None.');
        // By code, module and reply only: a Problem's message names what the story wrote (an item, a person,
        // the line itself), so no message is copied (B-a3-2).
        for (const item of list) {
            const where = [item?.module ? scrubLine(item.module, 60) : 'story-block', Number.isInteger(item?.index) ? `reply ${item.index}` : ''].filter(Boolean).join(', ');
            out.push(`- [${scrubLine(item?.code ?? 'PROBLEM', 40)}] ${where}`);
        }
        const counts = new Map();
        for (const item of list) counts.set(scrubLine(item?.code ?? 'PROBLEM', 40), (counts.get(scrubLine(item?.code ?? 'PROBLEM', 40)) ?? 0) + 1);
        if (list.length) out.push(`By code: ${[...counts].map(([code, count]) => `${code} ${count}`).join(', ')}.`);
    });

    // What the open card's offer left out or declined, one line each (packs/card-offer.js): pack, portrait and setting names only, scrubbed.
    const cardLines = (() => { try { return source.cardOffers?.() ?? []; } catch { return []; } })();
    if (cardLines.length) {
        section('Card offers');
        for (const text of cardLines.slice(-LIST_MAX)) out.push(`- ${scrubLine(text, 240)}`);
    }

    section('Saving');
    tryPart('the save status', () => {
        const save = source.save?.() ?? {};
        const seen = source.caught?.() ?? { saves: [], saveFailures: 0 };
        out.push(`Failing now: ${yes(save.failing)}. Unsaved changes: ${yes(save.dirty)}. Waiting to read the file back after a timed-out save: ${yes(save.suspect)}.`);
        out.push(`Failed saves this page load: ${num(seen.saveFailures ?? 0)}.`);
        for (const item of seen.saves ?? []) out.push(`- ${item.text}`);
    });

    section('Model calls');
    tryPart('the model calls', () => {
        const calls = source.calls?.() ?? null;
        out.push(callsLine(calls));
    });

    section('This chat');
    tryPart('the chat', () => {
        if (source.chatOpen && source.chatOpen() === false) { out.push('No chat open.'); return; }
        const counts = chatCounts(source.chat?.() ?? []);
        out.push(`Messages: ${num(counts.messages)}. Replies: ${num(counts.replies)}. Replies with a Story Suite record: ${num(counts.records)}. Size: about ${sizeText(counts.bytes)}.`);
    });

    section('Recent Story Suite errors');
    tryPart('the errors', () => {
        const errors = source.caught?.()?.errors ?? [];
        if (!errors.length) out.push('None caught since the page loaded.');
        for (const item of errors) out.push(`- ${item.text}`);
    });

    for (const { moduleId, fn } of (() => { try { return source.hooks?.() ?? []; } catch { return []; } })()) {
        const name = modules.find(module => module?.id === moduleId)?.name ?? moduleId;
        section(`${scrubLine(name, 60)} (its own)`);
        const got = await withLimit(() => fn(), HOOK_TIMEOUT_MS);
        if (got.late) out.push(`(no answer within ${HOOK_TIMEOUT_MS / 1000} s)`);
        else if (got.error) out.push(`(could not be read: ${scrubLine(got.error?.message ?? got.error, 160)})`);
        else {
            const lines = hookLines(got.value);
            out.push(...(lines.length ? lines : ['Nothing to say.']));
        }
    }
    return `${out.filter((line, at) => line !== '' || at > 0).join('\n').trim()}\n`;
}
