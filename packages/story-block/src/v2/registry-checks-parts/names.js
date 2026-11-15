// The host's module id and the command and widget prefixes it reserves.

// Commands the registry makes itself, so the command bus can run them like any other:
// `capture.<kind>` runs the owner's capture.apply on a change line (turn.js), and
// `module.init.<id>` adds a late module's initial slices (sdk.js). Modules cannot use these
// prefixes for their own commands.
//
// Internal commands (`isInternal(type)`): those two families, and any module command marked
// `internal: true` (the events part's `events.fire`). They are steps the host takes itself (a change
// line, a module's set-up, a due event): the command bus refuses them with cause 'ui', from the top or
// through ctx.call, and the public sdk refuses to send them at all, so no button, screen, widget or
// layout can name one. A command is marked either as `{ handler, internal: true }` in `commands`, or
// as a handler function that carries `internal === true` itself.
export const CAPTURE_PREFIX = 'capture.';
export const INIT_PREFIX = 'module.init.';
// The host's module id and the namespace of its standard widgets (MODULES §F9).
export const HOST_MODULE = 'story-block';

export const STANDARD_PREFIX = 'ss.';
