/* UI evidence reading: World State and Inner Chatter extraction, UI noise stripping and story prose. */
import { extractNarrationCapture } from './capture.js';

function plainUiEvidence(value) {
    return String(value || '')
        .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/gi, ' ')
        .replace(/<\/?details\b[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function collectTaggedBodies(source, tag) {
    const out = [];
    const escaped = String(tag || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return out;
    const complete = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}\\s*>`, 'gi');
    for (const match of String(source || '').matchAll(complete)) {
        const body = plainUiEvidence(match[1]);
        if (body) out.push(body);
    }
    return out;
}

function meguminBlockEvidence(blockBody) {
    const parts = [];
    for (const body of collectTaggedBodies(blockBody, 'World_State')) parts.push(`World State: ${body}`);
    for (const body of collectTaggedBodies(blockBody, 'NPC_Inner_Chatter')) parts.push(`NPC Inner Chatter: ${body}`);

    // A cut-off reply can leave the final useful block without a closing tag. Megumin's own
    // renderer keeps such partial blocks visible; preserve the same evidence boundary here,
    // but only when that useful tag is the last opened child in the envelope.
    for (const [tag, label] of [['World_State', 'World State'], ['NPC_Inner_Chatter', 'NPC Inner Chatter']]) {
        const open = new RegExp(`<${tag}\\b[^>]*>`, 'ig');
        const matches = [...String(blockBody || '').matchAll(open)];
        if (!matches.length) continue;
        const last = matches[matches.length - 1];
        const tail = String(blockBody || '').slice(last.index + last[0].length);
        if (new RegExp(`<\\/${tag}\\s*>`, 'i').test(tail)) continue;
        if (/<[A-Za-z][A-Za-z0-9_:-]*\b[^>]*>/.test(tail)) continue;
        const body = plainUiEvidence(tail);
        if (body) parts.push(`${label}: ${body}`);
    }
    return parts.join(' ');
}

function replaceMeguminMasterBlocks(source) {
    let text = String(source || '');
    text = text.replace(/<Blocks\b[^>]*>([\s\S]*?)<\/Blocks\s*>/gi, (_whole, body) => {
        const evidence = meguminBlockEvidence(body);
        return evidence ? ` ${evidence} ` : ' ';
    });
    // Truncated master envelope at end of message.
    text = text.replace(/<Blocks\b[^>]*>([\s\S]*)$/gi, (_whole, body) => {
        const evidence = meguminBlockEvidence(body);
        return evidence ? ` ${evidence} ` : ' ';
    });
    return text;
}

function replaceStandaloneMeguminEvidence(source) {
    let text = String(source || '');
    for (const [tag, label] of [['World_State', 'World State'], ['NPC_Inner_Chatter', 'NPC Inner Chatter']]) {
        const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi');
        text = text.replace(re, (_whole, body) => {
            const evidence = plainUiEvidence(body);
            return evidence ? ` ${label}: ${evidence} ` : ' ';
        });
    }
    // These are model/UI control surfaces, not story evidence. Normally they are inside the
    // master <Blocks> envelope and are removed above; stripping standalone copies keeps custom
    // or custom or alternate Megumin prompt layouts from contaminating dossier scans.
    for (const tag of ['Story_Tracker', 'CYOA', 'Bonds', 'Character_Sheet', 'New_NPC', 'NPC_Update']) {
        const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
        text = text.replace(re, ' ');
    }
    return text;
}

export function hasCompactMeguminWorldState(text) {
    const source = String(text || '');
    const bodies = [];
    for (const body of collectTaggedBodies(source, 'World_State')) bodies.push(body);
    for (const details of source.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)) {
        const inner = String(details[1] || '');
        const summary = String(inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || '')
            .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (/\bworld\s*state\b/i.test(summary)) bodies.push(plainUiEvidence(inner));
    }
    return bodies.some(body => /\bTime\s*&\s*Loc\s*:/i.test(body) && /\bNPCs\s+Present\s*:/i.test(body));
}

// Story Block hides its blocks (World State among them) in one comment at the end of a reply:
// `<!-- STORY_BLOCKS_V1\n<Blocks>…</Blocks>\n-->`. Unwrapping it to the inner <Blocks> lets the
// World State inside be read exactly as a plain Megumin <Blocks> is; every other comment is still
// stripped as markup. A reply cut off mid-envelope ends where the next comment begins. The `\b`
// keeps STORY_BLOCKS_V1_CUT and STORY_BLOCKS_V1_CONTEXT_* out.
const STORY_BLOCKS_ENVELOPE = /<!--\s*STORY_BLOCKS_V1\b((?:(?!<!--)[\s\S])*?)(?:-->|(?=<!--)|$)/gi;

function unwrapStoryBlocksEnvelope(source) {
    return String(source || '').replace(STORY_BLOCKS_ENVELOPE, (_whole, body) => ` ${body} `);
}

export function stripUiNoise(text) {
    let source = unwrapStoryBlocksEnvelope(extractNarrationCapture(text).text)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

    // Megumin Suite beta (2026-08-18+) emits one <Blocks> envelope. Preserve only the two
    // sections NPC State Delta intentionally treats as story evidence; discard CYOA, Bonds, sheets,
    // NPC Bank dossiers/updates, Story Tracker, and unknown/custom children by removing the
    // entire envelope after extracting World State + NPC Inner Chatter.
    source = replaceMeguminMasterBlocks(source);
    source = replaceStandaloneMeguminEvidence(source);

    // Some Megumin layouts place high-value identity/state evidence inside <details> blocks.
    // Preserve those evidence-bearing details while dropping unrelated collapsible UI.
    const withRelevantDetails = source.replace(/<details\b[^>]*>([\s\S]*?)<\/details>/gi, (_whole, inner) => {
        const summaryMatch = String(inner).match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
        const summary = String(summaryMatch?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const isWorldState = /\bworld\s*state\b/i.test(summary);
        const isInnerChatter = /\bnpc\s*inner\s*chatter\b/i.test(summary);
        if (!isWorldState && !isInnerChatter) return ' ';
        const body = plainUiEvidence(inner);
        const label = isWorldState ? 'World State' : 'NPC Inner Chatter';
        return body ? ` ${label}: ${body} ` : ' ';
    });

    return withRelevantDetails
        .replace(/<[^>]+>/g, ' ')
        .replace(/```[\s\S]*?```/g, match => match.replace(/```\w*/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * (1.2.12) A message's story alone: its narration and dialogue, without the World State, Inner
 * Chatter or any other block. Who takes part in a relationship moment is named here; a name that
 * only appears in a World State's lists (Off-Screen above all) is no part in the scene.
 */
export function storyProse(text) {
    let source = unwrapStoryBlocksEnvelope(extractNarrationCapture(text).text)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
        .replace(/<Blocks\b[^>]*>[\s\S]*?(?:<\/Blocks\s*>|$)/gi, ' ')
        .replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, ' ');
    for (const tag of ['World_State', 'NPC_Inner_Chatter', 'Story_Tracker', 'CYOA', 'Bonds', 'Character_Sheet', 'New_NPC', 'NPC_Update']) {
        source = source.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?(?:<\\/${tag}\\s*>|$)`, 'gi'), ' ');
    }
    return source
        .replace(/<[^>]+>/g, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
