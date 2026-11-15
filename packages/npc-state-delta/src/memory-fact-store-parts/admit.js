// Admits a scan's own fact candidates to keys, bounded per reply, with identity-collision quarantine.
import { factKey, factIdentity } from '../memory-fact-key.js';
import { cleanPayload } from '../memory-fact-text.js';
import { ADMIT_PER_REPLY, factSeen, withDisposition } from '../memory-fact-ledger.js';

const KIND_ORDER = ['met', 'lieCaught', 'milestone', 'quest', 'move', 'gift', 'fight', 'party'];

// A scan's own events as candidates -> keys, bounded per reply. Candidate: { kind, cls, R, ns, source, eventId, phase?, payload, rev?, date? }.
export function admitCandidates(candidates, facts, { locked = false } = {}) {
    const out = [];
    let next = facts;
    const list = [...(Array.isArray(candidates) ? candidates : [])]
        .map(candidate => ({ ...candidate, payload: cleanPayload(candidate.kind, candidate.payload) }))
        .filter(candidate => candidate.payload && Number.isInteger(candidate.R) && candidate.R >= 0 && ['M', 'A', 'O'].includes(candidate.cls))
        .map(candidate => ({ ...candidate, key: factKey(candidate), ident: factIdentity(candidate) }))
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.cls === 'A' ? 0 : 1) - (b.cls === 'A' ? 0 : 1) || (a.key < b.key ? -1 : 1));
    for (const candidate of list) {
        const row = next?.ledger?.keys?.find(item => item[0] === candidate.key);
        if (row && row[3] && row[3] !== candidate.ident) { next = withDisposition(next, candidate.key, candidate.R, 'q', row[3]); continue; }   // identity collision: quarantine
        if (factSeen(next, candidate.key, candidate.R)) continue;
        if (locked) { next = withDisposition(next, candidate.key, candidate.R, 'l', candidate.ident); continue; }
        if (out.filter(item => item.R === candidate.R).length >= ADMIT_PER_REPLY) { next = withDisposition(next, candidate.key, candidate.R, 'o', candidate.ident); continue; }
        out.push(candidate);
    }
    return { admitted: out, facts: next };
}
