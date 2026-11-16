// The present scene model: card matching, now lines, bubble kind and the shaped model with its signature.
import { normalizeName, npcNamedInText } from '../core-mechanics.js';
import { trimAtWord } from '../suite-handshake.js';
import { parseChatterLines } from './chatter-parse.js';
import { DOSSIER_LOOK_LABEL, NOW_PARTS, NOW_PART_MAX, NOW_TITLE_MAX } from './now-constants.js';
import { plain } from './shared-text.js';
import { parseWorldStateNpcs } from './world-state-parse.js';

/**
 * The present card a speaker or World State name belongs to, or ''. An exact (case-insensitive)
 * name or alias of exactly one card first, then Delta's usual name recognition (npcNamedInText:
 * a distinctive part of the name, not titles or role words) when exactly one card matches.
 */
export function matchPresentCard(name, cards = [], roster = []) {
    try {
        const key = normalizeName(name);
        if (!key) return '';
        const list = (Array.isArray(cards) ? cards : []).filter(card => card && plain(card.id) && plain(card.name));
        const exact = list.filter(card => [card.name, ...(Array.isArray(card.aliases) ? card.aliases : [])].some(label => normalizeName(label) === key));
        if (exact.length) return exact.length === 1 ? plain(exact[0].id) : '';
        const everyone = Array.isArray(roster) && roster.length ? roster : list;
        const named = list.filter(card => npcNamedInText(card, String(name), everyone));
        return named.length === 1 ? plain(named[0].id) : '';
    } catch {
        return '';
    }
}

/** The labelled now lines with a value, in order: [{ key, label, text, title }], cut at a word. */
export function nowParts(source = {}) {
    const values = source && typeof source === 'object' ? source : {};
    return NOW_PARTS.map(([key, label]) => {
        const value = plain(values[key]);
        return value ? { key, label, text: trimAtWord(value, NOW_PART_MAX), title: trimAtWord(value, NOW_TITLE_MAX) } : null;
    }).filter(Boolean);
}

/** 'speech' when two or more people speak in the chatter, 'thought' for one, '' for none. */
export function chatterBubbleKind(lines = []) {
    const speakers = new Set((Array.isArray(lines) ? lines : []).map(entry => normalizeName(entry?.speaker)).filter(Boolean));
    if (!speakers.size) return '';
    return speakers.size >= 2 ? 'speech' : 'thought';
}

function signatureOf(value) {
    const text = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

/**
 * Everything the present view shows beyond the cards themselves.
 * `cards`: [{ id, name, aliases, mood, condition, outfit }] (Delta's own tracked values).
 * `sceneText`: Story Block's World State for the latest reply, used only when `sceneOwned`.
 * `chatterText`: Story Block's NPC Inner Chatter for the latest reply.
 * Returns { now: { [id]: { parts: [{ key, label, text, title }], source } }, kind,
 * byCard: { [id]: [{ order, text }] },
 * others: [{ order, speaker, text }] (speaker null for a line with no speaker), texts: [string],
 * signature } where every `text`/`speaker`
 * is an index into `texts`. Never throws.
 */
export function presentSceneModel({ cards = [], roster = [], sceneText = '', sceneOwned = false, chatterText = '' } = {}) {
    const texts = [];
    const slot = value => texts.push(String(value)) - 1;
    const model = { now: {}, kind: '', byCard: {}, others: [], texts, signature: '' };
    try {
        const list = (Array.isArray(cards) ? cards : []).filter(card => card && plain(card.id));
        const world = sceneOwned && sceneText ? parseWorldStateNpcs(sceneText) : [];
        const fromWorld = new Map();
        for (const section of world) {
            const id = matchPresentCard(section.name, list, roster);
            if (id && !fromWorld.has(id) && (section.mood || section.condition || section.outfit)) fromWorld.set(id, section);
        }
        for (const card of list) {
            const id = plain(card.id);
            const section = fromWorld.get(id);
            const parts = nowParts(section || card);
            if (parts.length) {
                model.now[id] = {
                    // From the dossier the third line is the NPC's current look (appearance or
                    // form), not only clothes: "Look" (1.2.8). From World State it is the outfit, labelled Look too.
                    parts: parts.map(part => ({ key: part.key, label: part.key === 'outfit' ? DOSSIER_LOOK_LABEL : part.label, text: slot(part.text), title: slot(part.title) })),
                    source: section ? 'world-state' : 'dossier',
                };
            }
        }
        const names = [...list, ...(Array.isArray(roster) ? roster : [])]
            .flatMap(npc => [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])]);
        const lines = parseChatterLines(chatterText, { names });
        model.kind = chatterBubbleKind(lines);
        lines.forEach((entry, index) => {
            const id = matchPresentCard(entry.speaker, list, roster);
            const order = index + 1;
            if (id) (model.byCard[id] ||= []).push({ order, text: slot(entry.line) });
            else model.others.push({ order, speaker: entry.speaker ? slot(entry.speaker) : null, text: slot(entry.line) });
        });
    } catch (error) {
        console.warn('[NPC State Delta] present scene could not be shaped', error);
        model.now = {};
        model.kind = '';
        model.byCard = {};
        model.others = [];
        texts.length = 0;
    }
    model.signature = signatureOf([model.now, model.kind, model.byCard, model.others, texts]);
    return model;
}
