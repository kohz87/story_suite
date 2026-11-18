// Sends the Follow star: people.follow stores the flag (nothing else is told; the old Key people pin list is gone).

/** Resolves to people.follow's result: the star is only the stored `followed` flag. */
export async function sendFollow(ctx, d, on) {
  return ctx.port?.command?.('people.follow', { id: d.id, on });
}
