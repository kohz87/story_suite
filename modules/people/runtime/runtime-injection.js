/* NPC State prompt injection (role: prompt-injection). The live dossier text and the options a scan prompt is built from: the player's pending
   message and the off-screen people it names, the gear lines, the injection sent to the host (updateInjection) and its preview, the one-pass capture's
   rules kept or held, and the legacy prompt keys cleared on load. The prompt builders stay in core.js. Built by runtime-entry.js once per module instance
   with the shared runtime state. Bodies are moved from runtime-entry.js without change. */

import { getContext } from '../../../../../../extensions.js';
import { extension_prompt_types, extension_prompt_roles } from '../../../../../../../script.js';
import { replyScanned } from '../calls/scan-context.js';
import { cleanMessage, recentTranscript, tieDayAt } from '../transcript/transcript.js';
import { buildInjection, npcNamedInText, isTerminalNpcDeath } from '../core/core.js';
import { buildLinesParts } from '../core/core-prompts-lines.js';
import { withCastLinks } from '../dossier/cast-dossier-parts/cast-links.js';
import { injectDepthOf, getSettings, effectiveCustomFieldNames, rpgIsOn } from '../settings/runtime-settings.js';
import { narrationCaptureEnabled, replayScope } from '../calls/runtime-scan-helpers.js';

export function createInjectionPart(rt, deps) {
    const { CAPTURE_PROMPT_DEPTH, CAPTURE_PROMPT_KEY, CAPTURE_RULES_KEY, chatHydrationStatus, getChatKey, getChatState, hostedMeterView, hostedNotePromptOptions, awayReturnNotes, LEGACY_PROMPT_KEYS, PROMPT_KEY, scenePresenceView, adapterMeters } = deps;

    // The player message the next generation will answer: the chat tail when it is a user turn, or
    // the user turn before an assistant reply that is not yet reflected by a scan (swipe/regenerate).
    function pendingPlayerMessage(state) {
        const chat = getContext().chat || [];
        let tail = chat.length - 1;
        while (tail >= 0 && chat[tail]?.is_system) tail -= 1;
        if (tail < 0) return '';
        if (chat[tail]?.is_user) return cleanMessage(chat[tail]);
        if (replyScanned(state, tail)) return '';
        for (let i = tail - 1; i >= 0; i -= 1) {
            if (chat[i]?.is_system) continue;
            return chat[i]?.is_user ? cleanMessage(chat[i]) : '';
        }
        return '';
    }

    // Off-screen dossiers the player's pending message names. They join the next generation's
    // injection so an NPC entering at the player's call keeps her dossier; presence is still
    // decided by the scan of the reply.
    function namedByPlayerNpcIds(state) {
        const message = pendingPlayerMessage(state);
        if (!message) return [];
        // Hosted, "called in" is judged against the scene's presence, not the stored copy (which can be a scan behind).
        return (scenePresenceView(state?.npcs || []))
            .filter(npc => npc && !npc.present && !isTerminalNpcDeath(npc) && npcNamedInText(npc, message, state.npcs))
            .map(npc => npc.id);
    }

    // The names for the context's reminder (core-prompts-lines-parts/context.js): the people in the scene now (hosted: the scene's presence) and the
    // dossiers the player's message calls (`namedNpcIds`, who often arrive in the reply); the dead never.
    function presentNames(state, namedNpcIds = []) {
        const named = new Set(namedNpcIds);
        return scenePresenceView(state?.npcs || []).filter(npc => (npc?.present || named.has(npc?.id)) && npc.name && !isTerminalNpcDeath(npc)).map(npc => npc.name);
    }

    // (Story Block 2.18.0) The signature gear line of each pack cast dossier: { [npcId]: "Gear: A, B" }, only for those the host answers
    // for. Empty without a host, on an older Story Block without `packs.castGear`, and while gear is off or the person is in the party.
    function castGearLines(state) {
        const adapter = adapterMeters();
        if (!adapter?.castGearLine) return null;
        const lines = {};
        for (const npc of state?.npcs || []) {
            if (!npc?.id || !npc.castFrom?.key || !npc.name) continue;
            let line = '';
            try { line = adapter.castGearLine(npc.name); } catch { line = ''; }
            if (line) lines[npc.id] = line;
        }
        return Object.keys(lines).length ? lines : null;
    }

    // The live dossier injection under the current settings and scene defer (sent by updateInjection;
    // tokens() measures the same text).
    function liveInjectionText(state, settings, { namedNpcIds = namedByPlayerNpcIds(state), transcript = recentTranscript(4) } = {}) {
        const gearLines = castGearLines(state);
        const awayNotes = awayReturnNotes(state);
        return buildInjection(scenePresenceView(hostedMeterView(withCastLinks(state.npcs))), transcript, state.turn, settings.injectLimit, settings.behaviorCriteria, settings.injectBudgetTokens, state.socialGraph, { namedNpcIds, customFieldNames: effectiveCustomFieldNames(settings), ...(awayNotes ? { awayNotes } : {}), ...(gearLines ? { gearLines } : {}), storyDay: tieDayAt(), levelOn: rpgIsOn() });
    }

    // The one-pass lines a reply carries: the rules (when armed or kept for a swipe) and the context (armed only), with the note options they
    // were asked with. Hosted only; without Story Block nothing is asked for. Pure: updateInjection sends these, "What's sent" shows them.
    function captureParts(state, settings, { armed, rulesSent, namedNpcIds }) {
        if (!armed && !rulesSent) return { rules: '', context: '', noteOptions: {} };
        // (v2 hidden notes) The one-pass lines are asked for layered notes (with the rules, byte-identical each reply) and for
        // the story events of present people's locked notes (with the context); the list is kept for the reply that carries it.
        const noteOptions = hostedNotePromptOptions(state, settings);
        const built = adapterMeters()
            ? buildLinesParts({ ...noteOptions, moodWord: true, levelOn: rpgIsOn(), existingNpcs: state.npcs || [], turn: state.turn, dormantAfter: settings.staleArchiveAfter, namedNpcIds, present: presentNames(state, namedNpcIds) })
            : { rules: '', context: '' };
        return { rules: built.rules, context: armed ? built.context : '', noteOptions };
    }
    // A prompt text with the host's macros ({{user}}) filled in, as SillyTavern fills in an extension prompt.
    const withNames = (text, ctx = getContext()) => (text && typeof ctx.substituteParams === 'function' ? ctx.substituteParams(text) : text);
    // The one-pass lines the next ordinary reply would carry (it is armed, so rules and context), as "What's sent" shows them.
    function nextCaptureParts(state, settings) {
        if (!narrationCaptureEnabled(settings)) return { rules: '', context: '' };
        const { rules, context } = captureParts(state, settings, { armed: true, rulesSent: true, namedNpcIds: namedByPlayerNpcIds(state) });
        // (the rules name the reader with {{user}}: shown with the name filled in, as it is sent)
        return { rules: withNames(rules), context };
    }

    function updateInjection() {
        if (replayScope()) return;   // the injection is built once the replay is installed
        const settings = getSettings();
        const ctx = getContext();
        const injectionKey = getChatKey();
        const clear = reason => {
            rt.lastInjection = { text: '', reason, at: Date.now(), chatKey: injectionKey };
            ctx.setExtensionPrompt?.(PROMPT_KEY, '', extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
            ctx.setExtensionPrompt?.(CAPTURE_PROMPT_KEY, '', extension_prompt_types.IN_CHAT, CAPTURE_PROMPT_DEPTH, false, extension_prompt_roles.SYSTEM);
            ctx.setExtensionPrompt?.(CAPTURE_RULES_KEY, '', extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
            rt.sentCaptureRules = '';
        };
        if (injectionKey !== 'no-chat' && chatHydrationStatus(injectionKey) !== 'ready') {
            clear(`This chat's dossiers are not loaded (status: ${chatHydrationStatus(injectionKey)}); nothing is sent until they are.`);
            return;
        }
        if (injectionKey === 'no-chat') return clear('No chat is open.');
        if (!settings.enabled) return clear('NPC State is disabled.');
        const state = getChatState();
        // The recent story and who the player's message names: worked out once for both parts.
        const transcript = recentTranscript(4);
        const armed = rt.narrationCaptureArmed === injectionKey && narrationCaptureEnabled(settings);
        const rulesSent = narrationCaptureEnabled(settings) && !rt.captureRulesWithheld;
        if (!settings.inject && !armed && !rulesSent) return clear('"Inject present NPC state" is off.');
        const namedNpcIds = namedByPlayerNpcIds(state);
        const prompt = settings.inject ? liveInjectionText(state, settings, { namedNpcIds, transcript }) : '';
        const { noteOptions, ...parts } = captureParts(state, settings, { armed, rulesSent, namedNpcIds });
        const capture = parts.context;
        const present = (state.npcs || []).filter(npc => npc?.present);
        const depth = injectDepthOf(settings);
        rt.lastInjection = {
            text: prompt,
            reason: prompt ? '' : (!settings.inject ? '"Inject present NPC state" is off.' : (present.length ? 'No present NPC was selected for injection.' : 'No NPC is marked present in the latest scanned scene.')),
            at: Date.now(),
            chatKey: injectionKey,
            depth,
            namedByPlayer: (state.npcs || []).filter(npc => namedNpcIds.includes(npc.id)).map(npc => npc.name),
            captureChars: parts.rules.length + capture.length,
            captureRules: parts.rules,
            captureContext: capture,
            captureEventWatch: armed ? (noteOptions.eventWatch || []) : [],
        };
        ctx.setExtensionPrompt?.(PROMPT_KEY, prompt, extension_prompt_types.IN_CHAT, depth, false, extension_prompt_roles.SYSTEM);
        // Replaced on every build and emptied when not armed, so a spent reminder is never sent again;
        // the rules go and come with it (only armed replies carry them, byte-identical each time).
        ctx.setExtensionPrompt?.(CAPTURE_PROMPT_KEY, capture, extension_prompt_types.IN_CHAT, CAPTURE_PROMPT_DEPTH, false, extension_prompt_roles.SYSTEM);
        ctx.setExtensionPrompt?.(CAPTURE_RULES_KEY, parts.rules, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
        if (!parts.rules) rt.sentCaptureRules = '';
    }

    // Matches the prompts' own words, which keep the old product name (saved texts are not renamed).
    const OWN_REQUEST = /NPC State Delta's (?:isolated|targeted)|isolated relationship evaluator|Private NPC dossier scanner/;
    function holdCaptureRules() {
        const ctx = getContext();
        const rules = String(rt.lastInjection.captureRules || '');
        rt.sentCaptureRules = withNames(rules, ctx);
    }
    function keepCaptureRules(eventData) {
        const rules = String(rt.sentCaptureRules || '').trim();
        if (!rules || eventData?.dryRun === true || !Array.isArray(eventData?.chat)) return;
        const chat = eventData.chat;
        if (chat.some(message => typeof message?.content === 'string' && message.content.includes(rules))) return;
        if (chat.some(message => typeof message?.content === 'string' && OWN_REQUEST.test(message.content))) return;
        if ((getContext().chat || []).some(message => message && !message.is_user && !message.is_system) && !chat.some(message => message?.role === 'assistant')) return;
        let at = 0;
        while (at < chat.length && chat[at]?.role === 'system') at += 1;
        chat.splice(at, 0, { role: 'system', content: rules });
    }

    // (1.2.16) Earlier versions' prompt keys, emptied once on load.
    function clearLegacyPromptKeys() {
        const ctx = getContext();
        for (const key of LEGACY_PROMPT_KEYS) ctx.setExtensionPrompt?.(key, '', extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
    }

    function injectionPreview() {
        const settings = getSettings();
        const state = getChatKey() === 'no-chat' ? { npcs: [] } : getChatState();
        const text = String(rt.lastInjection.text || '');
        const lines = text.split('\n');
        const injectedNpcs = lines.map(line => line.match(/^- (.+?)(?: \(named by player\))?: IDENTITY/)?.[1]).filter(Boolean);
        const referencedNpcs = lines.map(line => line.match(/^- (.+?) \((?:mentioned, not present|deceased)/)?.[1]).filter(Boolean);
        return {
            sending: Boolean(text),
            reason: rt.lastInjection.reason || '',
            placement: (rt.lastInjection.depth ?? injectDepthOf(settings)) === 0
                ? 'In chat as a system message at the end, after your latest message (depth 0)'
                : `In chat as a system message, ${rt.lastInjection.depth ?? injectDepthOf(settings)} message(s) from the end`,
            capturePlacement: 'One-pass capture: its rules in the system prompt (unchanged reply to reply), its context and reminder in their own system message at the very end (depth 0)',
            builtAt: rt.lastInjection.at ? new Date(rt.lastInjection.at).toISOString() : '',
            presentNpcs: (state.npcs || []).filter(npc => npc?.present).map(npc => npc.name),
            namedByPlayer: (rt.lastInjection.namedByPlayer || []).filter(name => injectedNpcs.includes(name)),
            injectedNpcs,
            referencedNpcs,
            chars: text.length,
            estimatedTokens: Math.ceil(text.length / 4),
            budgetTokens: Number(settings.injectBudgetTokens) || 0,
            captureChars: Number(rt.lastInjection.captureChars) || 0,
            text,
        };
    }

    function scannerPromptOptions(state, settings, transcript, extra = {}) {
        const ctx = getContext();
        return {
            transcript,
            customFieldNames: effectiveCustomFieldNames(settings),
            existingNpcs: state.npcs,
            candidates: state.candidates,
            userName: ctx.name1 || 'User',
            charName: ctx.name2 || 'Character',
            maxNpcs: settings.maxNpcs,
            relationshipBaseline: settings.relationshipBaseline,
            relationshipCaps: settings.relationshipCaps,
            relationshipCriteria: settings.relationshipCriteria,
            impactCriteria: settings.relationshipImpactCriteria,
            memoryCriteria: settings.memoryCriteria,
            admissionMode: settings.admissionMode,
            ...extra,
        };
    }

    return { liveInjectionText, updateInjection, nextCaptureParts, holdCaptureRules, keepCaptureRules, clearLegacyPromptKeys, injectionPreview, scannerPromptOptions };
}
