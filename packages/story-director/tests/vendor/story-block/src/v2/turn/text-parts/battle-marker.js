// Battle marker: drops the reader-only `[battle]` marker lines from prompt text.

// The RPG's battle-log marker: a line `[battle]` of its own in a reply (src/v2/lean-rpg/view/battle-log.js draws the panel there).
// It is for the reader's eyes only, so it leaves the prompt history like the change blocks do: the narrator never sees its own old
// markers. The line goes with one blank line after it, so no gap is left.
const BATTLE_MARKER = /^[ \t]*\[battle\][ \t]*(?:\r?\n|$)(?:[ \t]*\r?\n)?/gim;
const HAS_BATTLE = /\[battle\]/i;
/** `text` without its `[battle]` marker lines. */
export function stripBattleMarker(text) {
    return typeof text === 'string' && HAS_BATTLE.test(text) ? text.replace(BATTLE_MARKER, '') : text;
}
