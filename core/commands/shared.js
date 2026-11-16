// Story Suite v2: the small values and error helpers every part of the command bus shares (limits, the error
// `ctx.fail` throws, `isRecord`, and the reply and ID helpers). commands.js keeps the public names and re-exports
// them, so importers still take MAX_DEPTH, CommandError, headReply and newId from commands.js.
// Public face: re-exports its parts.
export { MAX_DEPTH, CAUSES, CODE, MAX_PREVIEWS } from './shared-parts/limits.js';
export { ID_PREFIX, BASE36, ID_STREAM, newId } from './shared-parts/ids.js';
export { CommandError, fail, asCommandError, isRecord } from './shared-parts/errors.js';
export { replyOf, headReply, replyAt } from './shared-parts/replies.js';
