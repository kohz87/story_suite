// Builds the assist part: its classifier and extractor wired to the host's hooks, settings and status query, and the default part.

import { DEFAULTS, SCHEMA, SETTING, TIMEOUT_MS, createRunLog } from '../common.js';
import { PRECHECK, createClassifier, precheck } from '../classifier.js';
import { createExtractor } from '../extractor.js';
import { renderAssistSection } from '../section.js';
import { stCallModel, stChat, stChatId } from '../st-adapter.js';
import { STATUS_QUERY, HOST_MODULE_ID, sdkHasKind } from './host.js';
import { sdk } from './shared-sdk.js';

/**
 * The assist part. `deps` (all optional):
 *   callModel(prompt, { maxTokens, profile }) → text   (default: st-adapter's stCallModel)
 *   settings(view?) → this module's settings            (default: view.settings(moduleId), else the sdk's)
 *   chat() → SillyTavern's chat array, chatId() → its id (default: st-adapter)
 *   hasKind(kind) → boolean                             (default: the sdk's module list)
 *   grammar() → the kinds' one-line grammars            (default: none; the host passes the registry's)
 *   capture(text, { index, swipe })                     (default: none; the host passes it per reply)
 *   where() → { here, places, time }                    (default: none; the scene's place, the map's places, the story's date and time: where.js)
 *   moduleId = 'story-block', timeoutMs = 20000, timer, warn(text)
 */
export function createAssistPart({
    callModel = stCallModel,
    settings = null,
    chat = stChat,
    chatId = stChatId,
    hasKind = sdkHasKind,
    grammar = () => [],
    capture = null,
    where = null,
    moduleId = HOST_MODULE_ID,
    timeoutMs = TIMEOUT_MS,
    timer,
    warn = text => console.warn(`[Story Suite] assist: ${text}`),
} = {}) {
    const read = view => {
        let values = null;
        try {
            if (typeof settings === 'function') values = settings(view);
            else if (typeof view?.settings === 'function') values = view.settings(moduleId);
            else values = sdk()?.settings?.(moduleId);
        } catch {
            values = null;
        }
        return { ...DEFAULTS, ...(values && typeof values === 'object' ? values : {}) };
    };
    const log = createRunLog();
    const shared = { callModel, log, warn, timeoutMs, timer, chatId };
    const classifier = createClassifier({ ...shared, settings: read, chat, hasKind });
    const extractor = createExtractor({ ...shared, settings: () => read(null), grammar, capture, where });

    /** assist.status: { classifier: { on, last }, extractor: { on, last }, profile, runs }. */
    function status() {
        const values = read(null);
        return {
            classifier: { on: values[SETTING.classifier] === true, last: log.last('classifier') },
            extractor: { on: values[SETTING.extractor] === true, last: log.last('extractor') },
            profile: String(values[SETTING.profile] ?? '').trim(),
            runs: log.list(),
        };
    }

    return {
        domains: {},
        commands: { [PRECHECK]: precheck },
        queries: { [STATUS_QUERY]: () => status() },
        kinds: {},
        hooks: {
            beforeGenerate: (view, info) => classifier.beforeGenerate(view, info),
            afterReply: reply => extractor.afterReply(reply),
        },
        settings: {
            section: 'Assist',
            defaults: { ...DEFAULTS },
            schema: { ...SCHEMA },
            render: (el, api) => renderAssistSection(el, () => {
                if (typeof api?.query === 'function') {
                    try { return api.query(STATUS_QUERY); } catch { /* the part's own status below */ }
                }
                return status();
            }),
        },
        tabs: [],
    };
}

export const part = createAssistPart();
