// The command bus (SPEC §3): every change to v2 state is a command. A handler reads frozen copies,
// writes mutable drafts of the domains its module owns, may call other modules' commands inside the
// same transaction, and returns { summary, narrate, data }. The bus then diffs the drafts into ops,
// checks them (generic rules, then each touched domain's validator), bumps `meta.rev` as one more op
// and hands ops + receipt to the store. Anything that throws on the way rejects the whole command and
// leaves the store untouched. Synchronous: handlers cannot await, so neither does the bus (the public
// sdk may wrap the results in promises).
//
// Transaction rules worth knowing:
// * One set of drafts per command: a sub-command that drafts the same domain writes the same draft,
//   and `ctx.read` / `ctx.query` see the transaction's drafts, not just the head.
// * A sub-command that throws fails the whole command, even if the caller catches the error (its
//   half-written drafts cannot be told apart from the caller's). A `ctx.call` to a command that does
//   not exist throws UNKNOWN_COMMAND without failing the command, since nothing ran: a handler may
//   catch it to treat the other module as absent.
// * Every committed receipt bumps `meta.rev` by one, even when it changed nothing else, so each
//   receipt has its own rev.
// * What a handler is told about where it runs (MODULES §F2, the capture context): `ctx.caller` is the
//   module whose handler made this ctx.call (null at the top), `ctx.rev` the meta.rev this receipt will
//   have, `ctx.id(prefix)` a new `<prefix>_<8 base36>` drawn from the receipt's seed (so the same seed
//   gives the same IDs, and ctx.rng() is not disturbed), and, for capture runs, `ctx.carrier`
//   ({ index, swipe, key, practiceRule?, foeCap?, rules? }) and `ctx.chat` ({ lastUser, reply }); both are null for other commands.
//   `ctx.reply` ({ index, sid }) is the reply the command's changes are stored on, for every command:
//   the capture's carrier, else the head carrier (the last reply, where store.append puts a click's
//   ops, SPEC §2.2); null when the chat has no reply yet. Queries get the same as `tools.reply`, so
//   per-reply bookkeeping (a budget tally under the reply's sid) can be read and kept for a click too.
// * Internal commands (registry.isInternal: capture.*, module.init.*, events.fire) are refused with
//   REFUSED when the cause is 'ui', whether named at the top or through ctx.call.
// * Guarded blocks (docs/v2/REPLAY.md, contract §6): `ctx.replayGuard(guard, recorded?)` attaches the owner's
//   requirements to the command's root transaction (nested commands share it). The bus stamps the
//   receipt's `data.v2` with the host's Source and the guard, and hands the store a `block` (module,
//   source, guard, operation, recorded, result) to keep on the block's span; the store adds the block id,
//   the claims the ops make and the boundary. On replay the owner's `hooks.replayGuard` is asked
//   (`replayGuardCheck`); a throw or a malformed answer fails closed. `ctx.source` is the Source the block
//   will carry (null without a reply), `ctx.hash(value)` the contract's Hash.
// * Proof (docs/v2/EVIDENCE.md, contract §6): `ctx.proof({ kind, payload, parents? })` → `{ id, payloadHash }`, for
//   the module that owns the kind, inside the root transaction (evidence.js `submitProof` does the checks). The
//   proof is kept on the block's span (a command that gives proof makes a block even without a guard) and
//   pinned in `meta.proofs` by the same ops, so a block that does not apply, or a rolled-back root, publishes
//   nothing. A nested command reads the root's pending proof through `story.evidence` (the query's tools have
//   `pendingProofs`); a public query sees what is stored and pinned.
// * A command under a feature the reader turned off (MODULES §F100, registry.commandFeature) is refused
//   with FEATURE_OFF, at the top or through ctx.call; like UNKNOWN_COMMAND, nothing has run, so a
//   ctx.call caller may catch it. `ctx.feature(id)` says whether a feature is on.
//
// The parts: commands/shared.js has the limits and error helpers, commands/state.js the drafts, frozen reads,
// Source, cursor and proof, commands/guards.js the replay guard, commands/ctx.js the handler's context, and
// commands/transact.js one transaction. This file keeps createCommandBus and every public export.
// Public face: re-exports its parts.
export { createCommandBus } from './commands-parts/bus.js';
export { MAX_DEPTH, CommandError } from './commands-parts/names-errors.js';
export { headReply, newId, replyAt } from './commands-parts/names-replies.js';
