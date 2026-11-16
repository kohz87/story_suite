// The marker a test's simulated crash carries, and the check for it.

// A simulated crash (tests): the process is gone, so nothing the timeline would do on the way out may run. The
// timeline rethrows it from every place it would otherwise catch an error.
const CRASH = Symbol.for('story-block.timeline.crash');
/** An error that stands for the process dying at a phase. */
export function crash(message = 'The process stopped here (simulated crash).') {
    const error = new Error(message);
    error[CRASH] = true;
    return error;
}
export const crashing = error => Boolean(error) && error[CRASH] === true;
