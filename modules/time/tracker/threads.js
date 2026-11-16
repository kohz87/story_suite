// Story Director v2: the feature `story-director.threads` ("World-building threads"), in one place for every part
// that has to honour it (MODULES §F100). Pure.
//
// It owns the kinds agenda, event, clock, beat, secret (tracker), world, faction (chronicle) and route, landmark
// (atlas); the Pacing, World lines and Under [World] paragraphs of the fixed prompt; the notes' lines about those
// kinds; the Off-screen, Clocks, Beats and Secrets panels and the World card of the Director screen; the Chronicle
// tab; and the News and Factions of the World screen's Now view. It leaves `~ time`, `+ quest`, `+ hook` and
// `? check` alone. Off is the registry's normal off: nothing of it is taught, sent or drawn, what is stored is
// kept, and the state a reply is replayed to is the same. A pack event's lasting world change
// (`chronicle.lasting`) is code's, not the story's, and keeps working.
// Public face: re-exports its parts.

export { THREADS_FEATURE, threadsOn, THREADS_TAG } from './threads-parts/feature.js';
export { THREAD_KINDS_OWNED, ownedKind, withoutOwnedThreads } from './threads-parts/kinds.js';
