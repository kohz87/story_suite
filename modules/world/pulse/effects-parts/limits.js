// The pulse's time and room limits (jump, reply minutes, stale replies, rumour room).

export const JUMP_MINUTES = 360;
export const REPLY_MINUTES = 20;
/**
 * A Foes slot the narrator never cleared is a fight only while it moves: when the live slots read the same on this many replies running (the
 * replies' own rolls record them, `foes`), the pulse rolls again. A step from a reply written before this rule has no `age` flag and keeps the old rule.
 */
export const STALE_REPLIES = 2;

export const RUMOUR_ROOM = 54;
