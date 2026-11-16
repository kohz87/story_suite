// Migrating state saved under the old flag-sensitive hash, and repairing keys from hidden-message eras.
import { branchHash } from './hash.js';
import { fingerprintMessage, legacySystemFingerprint } from './fingerprint.js';
import { lineageCheckpointKeys } from './lineage-keys.js';
import { remapLineageKeys } from './lineage-remap.js';

// State saved while a message was hidden (or that is system) recorded that message under the old,
// flag-sensitive hash. When the stored lineage differs from the chat only in such messages, adopt
// the flag-independent hash and rewrite the stored keys once; real content differences are left for
// ordinary reconciliation.
export function migrateLegacyLineage(state, chat) {
    const previous = Array.isArray(state?.lineage) ? state.lineage : [];
    const messages = Array.isArray(chat) ? chat : [];
    if (!previous.length || !messages.length) return false;
    const rebased = previous.slice();
    let changed = false;
    const limit = Math.min(previous.length, messages.length);
    for (let i = 0; i < limit; i += 1) {
        if (previous[i] === fingerprintMessage(messages[i])) continue;
        if (previous[i] === legacySystemFingerprint(messages[i])) {
            rebased[i] = fingerprintMessage(messages[i]);
            changed = true;
        }
    }
    if (changed) remapLineageKeys(state, previous, rebased);
    return repairHiddenEraKeys(state, messages) || changed;
}

const eraRepairSignatures = new WeakMap();
const ERA_REPAIR_CUT_LIMIT = 400;

// Memory extensions hide messages progressively, so history saved by earlier versions holds keys
// from several "eras", each chained through the old flag-sensitive hash of the messages hidden
// by then. Older hides come first, so an era is a prefix of the currently hidden messages: try
// each prefix as the set that carried the old hash, and rewrite any stored key that matches.
function repairHiddenEraKeys(state, messages) {
    const hidden = [];
    messages.forEach((message, index) => { if (message?.is_system) hidden.push(index); });
    if (!hidden.length) return false;
    const target = messages.map(fingerprintMessage);
    const targetKeys = lineageCheckpointKeys(target);
    const holders = [];
    const add = (holder, field, messageId) => {
        const key = holder?.[field];
        if (key && Number.isInteger(messageId) && messageId >= 0 && messageId < targetKeys.length && key !== targetKeys[messageId]) holders.push({ holder, field, messageId, key });
    };
    for (const item of Array.isArray(state.checkpoints) ? state.checkpoints : []) {
        add(item, 'lineageKey', item.messageId);
        add(item, 'parentLineageKey', item.messageId - 1);
    }
    for (const entry of Array.isArray(state.rollbackJournal) ? state.rollbackJournal : []) {
        add(entry, 'lineageKey', entry.messageId);
        add(entry, 'parentLineageKey', entry.messageId - 1);
    }
    if (state.rollbackHead && typeof state.rollbackHead === 'object') add(state.rollbackHead, 'lineageKey', state.rollbackHead.messageId);
    for (const card of Array.isArray(state.inlineCards) ? state.inlineCards : []) add(card, 'lineageKey', card.messageId);
    if (!holders.length) return false;
    const signature = `${messages.length}:${hidden.length}:${hidden[0]}:${hidden.at(-1)}:${holders.length}`;
    if (eraRepairSignatures.get(state) === signature) return false;
    eraRepairSignatures.set(state, signature);

    const wanted = new Set(holders.map(item => `${item.messageId}:${item.key}`));
    const maxId = Math.max(...holders.map(item => item.messageId));
    const legacy = new Map();
    const legacyAt = index => {
        if (!legacy.has(index)) legacy.set(index, legacySystemFingerprint(messages[index]));
        return legacy.get(index);
    };
    const step = Math.max(1, Math.ceil((hidden.length + 1) / ERA_REPAIR_CUT_LIMIT));
    const cuts = [];
    for (let cut = 0; cut <= hidden.length; cut += step) cuts.push(cut);
    if (cuts.at(-1) !== hidden.length) cuts.push(hidden.length);
    const found = new Map();
    for (const cut of cuts) {
        const legacySet = new Set(hidden.slice(0, cut));
        let parent = 'root';
        for (let index = 0; index <= maxId; index += 1) {
            parent = branchHash(`${parent}|${index}|${legacySet.has(index) ? legacyAt(index) : target[index]}`);
            const id = `${index}:${parent}`;
            if (wanted.has(id) && !found.has(id)) found.set(id, targetKeys[index]);
        }
    }
    let repaired = false;
    for (const item of holders) {
        const replacement = found.get(`${item.messageId}:${item.key}`);
        if (replacement) { item.holder[item.field] = replacement; repaired = true; }
    }
    return repaired;
}
