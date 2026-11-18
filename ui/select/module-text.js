// The Start page's reader-facing words: each module card's icon, description and off line, and the three presets' names and what each turns on (NSD-WORDING.md, SA-CARDS).

/**
 * Card text by module id. The off line says what still runs when every switch on the card is off (the card's master switch
 * turns off only its own switches, never the module). Chat extras keeps its own text (settings-extras.js).
 */
export const CARD_TEXT = Object.freeze({
  'npc-state-delta': Object.freeze({ icon: '♥', desc: 'Dossiers, feelings, moods and secrets of everyone you meet', off: 'Dossiers and feelings are still kept, read every 3 replies; stages, moods, notes and the rest stop.' }),
  'story-block': Object.freeze({ icon: '▤', desc: 'The status strip, cards under replies, save points, weather, transport and the RPG', off: 'The bag, money, places, quests and time are still kept; these extras stop.' }),
  'story-director': Object.freeze({ icon: '🎬', desc: 'The story’s plan and the world that moves off-screen', off: 'The story clock still runs; the cast, threads, trips, the world pulse and the rest stop.' }),
});

/** The three presets in order: what each turns on, as the features' own preset switches say (core/features.js presetSwitches). */
export const PRESET_TEXT = Object.freeze([
  Object.freeze({ id: 'lean', name: 'Lean', desc: 'The bag, money, places, quests, time and dossiers. Off: weather, your look, transport, Pick what you take, threads, trips, arcs, NPC initiative, and people’s stages, moods, notes, feeling rules and repeat limits; people are read every 3 replies.' }),
  Object.freeze({ id: 'standard', name: 'Standard', desc: 'Today’s defaults: everything Lean turns off is on.' }),
  Object.freeze({ id: 'full', name: 'Full', desc: 'Standard plus choices, inner chatter and a check roll before each reply.' }),
]);
