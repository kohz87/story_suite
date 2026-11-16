// Reading what was caught so far, and forgetting it for tests.
import { caught } from './shared-caught.js';

/** What was caught so far (copies). */
export const caughtSoFar = () => ({ errors: caught.errors.map(item => ({ ...item })), saves: caught.saves.map(item => ({ ...item })), saveFailures: caught.saveFailures });
/** Tests: forget what was caught. */
export function resetCaught() {
    caught.errors.length = 0;
    caught.saves.length = 0;
    caught.saveFailures = 0;
}
