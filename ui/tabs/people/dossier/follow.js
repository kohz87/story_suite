// Sends the Follow star: people.follow stores the flag, then the narrator's list follows it (a followed person is pinned, an unfollowed one unpinned).
import { can } from '../../../runtime/can.js';

const aliasesOf = d => (d.profile?.aliases ? String(d.profile.aliases).split(',').map(a => a.trim()).filter(Boolean) : []);

/** Resolves to people.follow's result; only when that works is the Story Director's key list asked too (its refusals, such as an unknown or already removed pin, never undo the star). */
export async function sendFollow(ctx, d, on) {
  const result = await ctx.port?.command?.('people.follow', { id: d.id, on });
  if (result?.ok === false) return result;
  const type = on ? 'keypeople.pin' : 'keypeople.unpin';
  if (can(ctx, type)) {
    const aliases = aliasesOf(d);
    const payload = on ? { name: d.name, followed: true, ...(aliases.length ? { aliases } : {}) } : { name: d.name };
    try { await ctx.port.command(type, payload); } catch { /* the star stands; the narrator list is best effort */ }
  }
  return result;
}
