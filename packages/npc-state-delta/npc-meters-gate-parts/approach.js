// Gating one story-line meter move by the approach rules: less, backfire or suspicion.
import { isInt, isReply, METERS_GATED } from './shared-values.js';
import { FLATTERY_KINDS, normalizeApproachKind } from './kinds.js';
import { GATE_SOURCE, GATE_LOW_TRUST_BELOW, GATE_BACKFIRE_STEP } from './gate-rules.js';
import { strengthRule } from './strengths.js';
import { normalizeGateSettings } from './settings.js';
import { normalizeApproachRing } from './ring.js';
import { priorApproaches, addApproach } from './ring-window.js';
import { gateCue } from './cue.js';

const isLowTrust = trust => typeof trust === 'number' && trust < GATE_LOW_TRUST_BELOW;

/**
 * Gate one story-line meter move. Inputs: source ('story' or a scan source), via (approach label or null), day (story day
 * before the reply), reply (its ID or index), name (for the cue), trust (the NPC's trust before the move), delta (the move
 * { trust, affection, tension }), ring (the NPC's stored `via` ring), settings (gate settings, normalized here).
 *
 * Rules, in order:
 *   back   n >= backfireAt: a positive affection is dropped, tension +1, trust set to below zero (min(trust, 0) - 1).
 *   susp   praise or gift from trust below GATE_LOW_TRUST_BELOW with a positive affection: that affection moves to tension.
 *   less   n > 1 (a repeat within the window): each positive trust, affection and tension move is multiplied by the factor.
 *   none   otherwise, or when the source is not 'story', or the label is not a known kind.
 * n counts the same kind in the window, this reply included (the first approach is n = 1).
 *
 * Returns { delta, mode, n, via, cue, gate, ring }: the adjusted move; the outcome tag; the cue text (or ''); the gate record
 * for the last-change record (null when none fired); and the ring to store (updated for a story approach, unchanged otherwise).
 */
export function gateApproach({ source, via, day, reply, name, trust, delta, ring, settings }) {
    const kind = normalizeApproachKind(via);
    const out = { ...(delta ?? {}) };
    const stored = normalizeApproachRing(ring);
    if (source !== GATE_SOURCE || !kind || !isInt(day) || !isReply(reply)) {
        return { delta: out, mode: 'none', n: 0, via: kind, cue: '', gate: null, ring: stored };
    }
    const config = normalizeGateSettings(settings);
    const rule = strengthRule(config.strength);
    const sameKind = priorApproaches(stored, { day, reply, windowDays: config.windowDays }).filter(entry => entry.v === kind);
    const n = sameKind.length + 1;
    const span = n > 1 ? day - Math.min(...sameKind.map(entry => entry.d)) + 1 : 1;

    let mode = 'none';
    if (n >= rule.backfireAt) {
        mode = 'back';
        if (out.affection > 0) out.affection = 0;
        out.tension = (out.tension ?? 0) + GATE_BACKFIRE_STEP;
        out.trust = Math.min(out.trust ?? 0, 0) - GATE_BACKFIRE_STEP;
    } else if (FLATTERY_KINDS.includes(kind) && isLowTrust(trust) && out.affection > 0) {
        mode = 'susp';
        out.tension = (out.tension ?? 0) + out.affection;
        out.affection = 0;
    } else if (n > 1) {
        mode = 'less';
        for (const meter of METERS_GATED) if (out[meter] > 0) out[meter] = Math.trunc(out[meter] * rule.less);
    }

    const gate = mode === 'none' ? null : { day, reply, via: kind, mode, n, span };
    return {
        delta: out,
        mode,
        n,
        via: kind,
        cue: gateCue({ mode, via: kind, name }),
        gate,
        ring: addApproach(stored, { day, reply, kind }),
    };
}
