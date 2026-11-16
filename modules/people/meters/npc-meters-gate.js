// NPC anti-lever gate: a story line that repeats one approach (praise, gift, help, flirt, threat, shared danger) to the
// same NPC gives less each time, backfires on the repeat the strength sets, and reads praise or a gift from low trust as
// pressure. Pure: no DOM, no clock, no randomness, no mutation of the inputs. The story day and the reply are given in.
// The recent-approach ring (`via` on the NPC record) is written by the caller in the same op as the move it gates, so a
// replay, a rebuild, a swipe and a Re-read give the live values.
//
//   ring  [{ d: story day, r: reply ID or index, v: approach kind }]   at most RECENT_APPROACH_MAX, oldest first
//   gate  { day, reply, via, mode, n, span }   the last outcome; mode 'less' | 'back' | 'susp'
//         n     this approach's place in the window (1 = first)
//         span  days from the first counted approach of this kind to this day, inclusive
//
// Only source 'story' (the story's own meter lines) is gated. A scan-forwarded change passes through unchanged and writes
// no ring entry. The delta is the reply's meter move { trust, affection, tension } in integer step units; the gate adds
// tension (backfire, pressure) and sets trust below zero only on a backfire.
//
// Called by: src/npc-meters.js run() through gateStoryLine() (a story line with `| via:`, only while the feature
// npc-state-delta.anti-lever is on); src/npc-meters-pacing.js (the last-event record) and src/npc-meters-prompt.js (the cue).
// The ring is stored on the NPC record as ONE text leaf (`via`, compact JSON), so the host writes and replays it whole.
// Never imports other NSD modules.
// Public face: re-exports its parts.

export { APPROACH_KINDS, normalizeApproachKind } from './npc-meters-gate-parts/kinds.js';
export { GATE_SOURCE, GATE_MODES, GATE_LOW_TRUST_BELOW, GATE_BACKFIRE_STEP } from './npc-meters-gate-parts/gate-rules.js';
export { GATE_STRENGTHS, DEFAULT_GATE_SETTINGS, strengthRule } from './npc-meters-gate-parts/strengths.js';
export { GATE_WINDOW_MAX, normalizeGateSettings } from './npc-meters-gate-parts/settings.js';
export { RECENT_APPROACH_MAX, approachRingProblems, normalizeApproachRing } from './npc-meters-gate-parts/ring.js';
export { priorApproaches, addApproach } from './npc-meters-gate-parts/ring-window.js';
export { GATE_RING_TEXT_MAX, readApproachRing, approachRingText } from './npc-meters-gate-parts/ring-text.js';
export { ordinalWord, gateCue, describeGate } from './npc-meters-gate-parts/cue.js';
export { gateApproach } from './npc-meters-gate-parts/approach.js';
export { gateEventProblems, gateStoryLine } from './npc-meters-gate-parts/story-line.js';
