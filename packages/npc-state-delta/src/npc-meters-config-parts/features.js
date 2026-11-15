// The feature list with each feature's default, and the map of those defaults.
import { FEATURE_SOCIAL } from '../social-check.js';
import { FEATURE_STAGES, FEATURE_DRIFT, FEATURE_PRESETS, FEATURE_SCAN_EVERY_REPLY } from './feature-ids.js';
import { FEATURE_GATE, FEATURE_MOOD_PULL, FEATURE_NOTES } from './feature-ids-more.js';

// "How much to track" (Story Block): the Lean preset turns this feature off; Standard is its default.
const LEAN_OFF = Object.freeze({ lean: false });
export const FEATURES = Object.freeze([
    Object.freeze({ id: FEATURE_STAGES, label: 'Stage ladders and milestones', describe: 'Stages that need several meters at once and a story milestone; promotion waits out a conflict, a stage is lost only after a sustained low.', default: true, prompt: true, presets: LEAN_OFF }),
    Object.freeze({ id: FEATURE_DRIFT, label: 'Meters drift each story day', describe: 'Meters with a drift setting move toward their resting value as story days pass (needs Story Director\'s clock).', default: false }),
    Object.freeze({ id: FEATURE_PRESETS, label: 'Meter presets and rules', describe: 'One-click meter sets (Companion, Rival, Mentor and packs\') and each meter\'s rule line in the story\'s instructions.', default: true, prompt: true, presets: LEAN_OFF }),
    // Read-only (src/social-check.js): no prompt text, no state; a dice module asks npc.socialModifier.
    Object.freeze({ id: FEATURE_SOCIAL, label: 'Social checks use the dossier', describe: 'A persuade, charm, intimidate or deceive check against an NPC gets a small bonus or penalty from their meters, stage and disposition (for Story Director\'s checks or another dice module).', default: true }),
    // Read by index.js (scanAfterEveryReply): no prompt text, no state. Off, the automatic scan runs every 3 replies (or
    // "Scan every" when larger), reading every reply since the last scan; a manual scan is never held back.
    Object.freeze({ id: FEATURE_SCAN_EVERY_REPLY, label: 'Scan after every reply', describe: 'Off: the automatic scan runs every 3 replies (or the "Scan every" setting if larger) and that scan reads every reply since the last one, so a reply in between is read, not lost. A manual scan always runs.', default: true, presets: LEAN_OFF }),
    // A story line may say `| via: praise`; the same approach to the same person again soon gives less and then backfires (npc-meters-gate.js).
    Object.freeze({ id: FEATURE_GATE, label: 'Anti-lever: repeated approaches give less', describe: 'A story line may name its approach (praise, gift, help, flirt, threat, shared danger); repeating it to one person within a few days gives less, then backfires. Story lines only.', default: true, prompt: true, presets: LEAN_OFF }),
    // Mood and pull (npc-mood.js, npc-instincts.js): code-set state on each record plus tail lines for present NPCs. On by default; a reply
    // already written keeps its stored ops (replay is unchanged), a reader may turn it off in the feature list.
    Object.freeze({ id: FEATURE_MOOD_PULL, label: 'Mood and pull', describe: 'Each person has a mood (how a betrayal or a trust drop left them) and a pull (an instinct such as wanting closure or belonging); the narrator is told both for people present.', default: true, prompt: true, presets: LEAN_OFF }),
    // Dossier notes: four story kinds (lie, know, taste, tie), code-kept leaves on each record and optional tail lines. Their grammar is
    // only in the static prompt while this is on; a reply written before it existed never holds one of those lines.
    Object.freeze({ id: FEATURE_NOTES, label: 'Dossier notes', describe: 'The story may note a lie a person told, what they know of others, their tastes and ties (ally, rival, owes); a lie the story catches costs trust. Hidden until revealed.', default: true, prompt: true, presets: LEAN_OFF }),
]);
export const FEATURE_DEFAULTS = Object.freeze(Object.fromEntries(FEATURES.map(feature => [feature.id, feature.default])));
