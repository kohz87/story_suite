/* NPC State Delta the scanner, backfill, dossier import and refresh prompts with the Stage 4 appearance and death rules. */
import * as mechanics from '../core-mechanics.js';
import { normalizeAppearanceForms } from '../../appearance/appearance.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';

const COMPACT_STAGE4_RULE = `\nS4: forms/current; confirmed death terminal.`;
// Form rules shared by every prompt. The scanner and Refresh already define flat Appearance (current
// visible presentation; correction=>refine, clothes/form change=>change+reason) in their own rules, so
// only backfill and dossier import, which do not, get that sentence here.
const APPEARANCE_FORM_RULES = 'With named forms, each form appearance is that form\'s COMPLETE visible appearance (body+outfit); overallAppearance is only for an NPC without forms. Named anatomy uses appearanceForms:[{name,appearance,state:"refine|change",reason}]+currentForm/currentFormState:"select"; switches preserve other forms. Unknown transformed form=>currentFormState:"unknown"+grounded current appearance; never reuse another form\'s anatomy. Omission preserves; Appearance lock protects all appearance state.';
const APPEARANCE_RULES = `\nSTAGE 4 APPEARANCE: ${APPEARANCE_FORM_RULES}`;
const APPEARANCE_RULES_WITH_FLAT = `\nSTAGE 4 APPEARANCE: appearance=current outfit/gear/visible condition. Explicit correction/reveal=>refine corrected FULL appearance; changed clothes/form/presentation=>change+reason FULL appearance. ${APPEARANCE_FORM_RULES}`;
const DEATH_RULES = `\nSTAGE 4 DEATH: explicit death is terminal: lifeState:"deceased"+lifeStateCertainty:"explicit"; later output cannot return that NPC to alive/present/worldActive.`;
// (cleanup step 12, I-10) The one-pass rules are written before the reply exists, and the reply can
// bring a transformation or a death, so they always carry the form and death rules, in short.
const CAPTURE_STAGE4_RULES = `\nSTAGE 4: named forms=>appearanceForms:[{name,appearance=its COMPLETE look,state:"refine|change",reason}]+currentForm,currentFormState:"select|unknown" (unknown=>grounded appearance, never another form's anatomy); a switch keeps other forms; overallAppearance only without forms. Explicit death (deceased+explicit) is terminal: never alive/present/worldActive again.`;
const PROFILE_REFRESH_APPEARANCE_RULE = `\nREFRESH: visible anatomy changes are form evidence even without literal "form"/"transform" wording.`;
function hasImplicitAnatomicalTransition(transcript = '') {
    const text = String(transcript || '');
    const anatomy = /\b(horns?|wings?|tails?|ears?|feathers?|plumage|quills?|scales?|talons?|claws?|beaks?|fins?|gills?|antlers?)\b/i.test(text);
    const transition = /\b(dissolv(?:e|ed|es|ing)?|retract(?:ed|s|ing)?|withdraw(?:n|s|ing)?|vanish(?:ed|es|ing)?|disappear(?:ed|s|ing)?|melt(?:ed|s|ing)?|smooth(?:ed|s|ing)?|emerg(?:e|ed|es|ing)|sprout(?:ed|s|ing)?|grow(?:n|s|ing)?|manifest(?:ed|s|ing)?|materializ(?:e|ed|es|ing)|fade(?:d|s|ing)?|recede(?:d|s|ing)?|absorb(?:ed|s|ing)?|sink(?:s|ing)?\s+(?:back|into)|draw(?:n|s|ing)?\s+(?:back|into))\b/i.test(text);
    return anatomy && transition;
}
function needsDetailedStage4(options = {}) {
    const transcript = String(options?.transcript || '');
    const existing = Array.isArray(options?.existingNpcs) ? options.existingNpcs : [];
    return existing.some(npc => (npc?.appearanceForms?.length || npc?.currentForm || isTerminalNpcDeath(npc)))
        || /\b(transform(?:s|ed|ing|ation)?|form|shape-?shift|metamorph|human form|beast form|dragon form|dies|died|dead|deceased|killed|death)\b/i.test(transcript)
        || hasImplicitAnatomicalTransition(transcript);
}
const ESTABLISHED_FORM_CONTEXT_CHARS = 240;
function establishedAppearanceContext(options = {}) {
    const transcriptKey = mechanics.normalizeName(options?.transcript || options?.dossierText || '');
    const source = Array.isArray(options?.existingNpcs) ? options.existingNpcs : [options?.existingNpc, options?.targetNpc].filter(Boolean);
    const records = source.filter(npc => {
        if (!npc || (!npc.appearanceForms?.length && !npc.currentForm && !npc.currentFormUnknown)) return false;
        if (source.length <= 1 || npc.present || npc.worldActive) return true;
        const labels = [npc.name, ...(npc.aliases || [])].map(mechanics.normalizeName).filter(Boolean);
        return labels.some(label => transcriptKey.includes(label));
    }).slice(0, 6).map(npc => ({
        id: npc.id,
        name: npc.name,
        currentForm: npc.currentForm || '',
        currentFormUnknown: Boolean(npc.currentFormUnknown),
        // The current form is shown whole; the others only need enough to be recognised and kept.
        appearanceForms: normalizeAppearanceForms(npc.appearanceForms).map(form => (form.name === npc.currentForm || form.appearance.length <= ESTABLISHED_FORM_CONTEXT_CHARS
            ? form
            : { ...form, appearance: `${form.appearance.slice(0, ESTABLISHED_FORM_CONTEXT_CHARS).replace(/\s+\S*$/, '')}…` })),
    }));
    return records.length ? `\nEstablished Stage 4 appearance forms (preserve omissions): ${JSON.stringify(records)}` : '';
}
function insertPromptBlockBefore(prompt = '', anchor = '', block = '') {
    const source = String(prompt);
    const addition = String(block || '');
    const index = anchor ? source.indexOf(anchor) : -1;
    if (!addition) return source;
    if (index < 0) return `${source}${addition}`;
    const prefix = source.slice(0, index);
    const lineBreak = prefix.endsWith('\r\n') ? '\r\n' : (prefix.endsWith('\n') ? '\n' : '');
    if (!lineBreak) return `${prefix}${addition}\n${source.slice(index)}`;
    return `${prefix.slice(0, -lineBreak.length)}${addition}${lineBreak}${source.slice(index)}`;
}
// (cleanup step 12) The terminal-death wording and Refresh's form keys are written in the prompts
// themselves now (core-mechanics; the registry's return shapes), not patched in here.
function appendRules(prompt, options = {}) {
    return `${String(prompt)}${APPEARANCE_RULES_WITH_FLAT}${DEATH_RULES}${establishedAppearanceContext(options)}`;
}
export function buildScannerPrompt(options = {}) {
    const base = mechanics.buildScannerPrompt(options);
    const context = establishedAppearanceContext(options);
    if (options.narrationCapture) return `${insertPromptBlockBefore(base, 'Identity index (matching only):', CAPTURE_STAGE4_RULES)}${context}`;
    const prefixed = insertPromptBlockBefore(base, 'Identity index (matching only):', COMPACT_STAGE4_RULE);
    return needsDetailedStage4(options) ? `${prefixed}${APPEARANCE_RULES}${DEATH_RULES}${context}` : `${prefixed}${context}`;
}
export function buildBackfillPrompt(options = {}) { return appendRules(mechanics.buildBackfillPrompt(options), options); }
export function buildDossierImportPrompt(options = {}) { return appendRules(mechanics.buildDossierImportPrompt(options), options); }
export function buildProfileRefreshPrompt(options = {}) {
    const base = mechanics.buildProfileRefreshPrompt(options);
    const stableRules = `${PROFILE_REFRESH_APPEARANCE_RULE}${APPEARANCE_RULES}${DEATH_RULES}`;
    const prefixed = insertPromptBlockBefore(base, 'Recent story window (EVIDENCE ONLY;', stableRules);
    return `${prefixed}${establishedAppearanceContext(options)}`;
}
