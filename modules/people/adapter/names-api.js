// The names NPC State answers and runs on the host: its queries, its commands, and the replies after which it takes its per-reply step.

export const QUERY_NAMES = Object.freeze(['npc.present', 'npc.dossier', 'npc.known', 'npc.portrait', 'npc.meters', 'npc.cast', 'npc.next', 'npc.awayMemory', 'npc.castMade', 'npc.socialModifier', 'npc.identity', 'npc.catchUp', 'npc.dormantAfter']);

export const COMMAND_NAMES = Object.freeze(['npc.adjust', 'npc.set', 'npc.refresh', 'npc.milestone', 'npc.open', 'npc.tick', 'npc.flag', 'npc.meet', 'npc.mood', 'npc.taste', 'npc.drives', 'npc.arrive']);

// The replies after which Delta takes its per-reply step (npc.tick): a new reply or a new swipe of
// one, never a Continue, a Re-read or late change lines (the same reply again).
export const TICK_TURNS = Object.freeze(['normal', 'swipe', 'regenerate']);
