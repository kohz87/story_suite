// What Settings › Tools reads that is not the engine itself: the Inspector's replies and their problems, the Diagnostics report,
// and Story Suite's console errors kept for that report. Built once at boot (the old view built them while it was mounted).
import { buildReport, captureConsole, caughtSoFar } from '../diagnostics.js';
import { createInspectorSource } from '../../packs/screens/inspect.js';
import { isModuleFailure, moduleFailures } from '../turn/apply-report.js';
import { FLAGS, flagOn } from '../runtime/flags.js';

/**
 * What the Inspector lists as reply `index`'s problems: the blocks its replay skipped, what the turn met reading it (change lines not used,
 * with why; with `suite.isolatedApply` on, a module's failures grouped under its name, after the rest) and the newest head-selection notice per module.
 */
export function inspectorProblems(index, { store, turn, isolated = () => false, nameOf = id => id }) {
    const out = [];
    for (const item of store.problems?.() ?? []) if (item.index === index) out.push({ code: item.code ?? 'SKIPPED', message: item.message });
    const all = turn?.problems?.() ?? [];
    const told = all.filter(item => item?.index === index);
    const failed = isolated() === true ? moduleFailures(told, index, nameOf) : [];
    for (const item of told) if (!(failed.length && isModuleFailure(item))) out.push({ code: item.code ?? '', message: item.line ? `"${item.line}": ${item.message}` : item.message });
    for (const item of failed) out.push({ code: item.code, message: `${item.name}: ${item.reason}` });
    const fell = new Map();
    for (const item of all) if (item?.code === 'SELECTION_FELL' && !Number.isInteger(item.index)) fell.set(item.module, item);
    for (const item of fell.values()) out.push({ code: item.code, message: item.message });
    return out;
}

/**
 * `startToolsParts({ runtime, ctx, doc?, version?, cardLog? })` → `{ inspector, report(), stop() }`: `inspector` is the Inspector's source
 * (`replies()`, `reply(index)`), `report()` a promise of the Diagnostics text. Console errors are caught from here on (once per page).
 */
export function startToolsParts({ runtime, ctx, doc = globalThis.document, version = '', cardLog = [] }) {
    const { registry, store, settings } = runtime;
    const liveCtx = () => globalThis.SillyTavern?.getContext?.() ?? ctx;
    const nameOf = id => registry.modules?.().find(def => def.id === id)?.name ?? id;
    const offConsole = captureConsole();
    const inspector = createInspectorSource({
        store,
        chat: () => ctx.chat ?? [],
        chatId: () => (typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId),
        problems: index => inspectorProblems(index, { store, turn: runtime.turn, nameOf, isolated: () => flagOn(() => ctx?.extensionSettings, FLAGS.isolatedApply) }),
    });
    // SillyTavern's version as its page shows it, else its /version answer.
    const stVersion = async () => {
        const shown = doc?.querySelector?.('#version_display')?.textContent?.trim();
        if (shown && shown !== 'SillyTavern') return shown;
        const fetcher = (doc?.defaultView ?? globalThis).fetch;
        if (typeof fetcher !== 'function') return '';
        const answer = await fetcher('/version');
        const data = answer?.ok ? await answer.json() : null;
        return data?.pkgVersion ? `SillyTavern ${data.pkgVersion}` : '';
    };
    const promptParts = typeof runtime.turn?.previewFit === 'function' ? () => runtime.turn.previewFit()
        : typeof runtime.turn?.preview === 'function' ? () => runtime.turn.preview() : null;
    const report = () => buildReport({
        stVersion,
        hostVersion: version || registry.hostVersion?.() || '',
        modules: () => registry.modules().map(def => ({ id: def.id, name: def.name ?? def.id, version: def.version ?? '' })),
        refusals: () => registry.refusals?.() ?? [],
        features: () => runtime.features?.list?.() ?? [],
        hostSettings: () => settings(),
        settingsOf: id => settings(id),
        promptParts,
        problems: () => runtime.turn?.problems?.() ?? [],
        save: () => ({ failing: store.failing?.(), dirty: store.dirty?.(), suspect: typeof store.suspect === 'function' ? store.suspect() : undefined }),
        calls: () => runtime.callQueue?.stats?.() ?? null,
        caught: caughtSoFar,
        chat: () => liveCtx()?.chat ?? [],
        chatOpen: () => Boolean(liveCtx()?.getCurrentChatId?.() ?? liveCtx()?.chatId),
        hooks: () => registry.hookEntries?.('diagnostics') ?? [],
        cardOffers: () => cardLog.slice(),
    });
    return { inspector, report, stop() { offConsole?.(); } };
}
