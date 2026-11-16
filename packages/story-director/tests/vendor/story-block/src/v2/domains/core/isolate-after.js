// Story Block's isolated afterCapture merge (flag `suite.isolatedApply` on): each core part runs on its own, so one that throws costs only its own steps.
// A part that throws, or whose promise rejects, adds a FAILED problem naming it; the other parts' commands and problems are kept.

// The merged answer of `answers` (one per part, in part order): all commands and problems, else the first answer that is not null/undefined.
function join(answers) {
    const commands = answers.flatMap(answer => (Array.isArray(answer?.commands) ? answer.commands : []));
    const problems = answers.flatMap(answer => (Array.isArray(answer?.problems) ? answer.problems : []));
    if (!commands.length && !problems.length) return answers.find(answer => answer !== undefined && answer !== null);
    return { ...(commands.length ? { commands } : {}), ...(problems.length ? { problems } : {}) };
}

/** The merged afterCapture hook of `fns` that keeps the other parts' steps when one part fails. */
export function isolatedAfterCapture(fns) {
    return (...args) => {
        const failed = (fn, at) => error => ({ problems: [{ code: 'FAILED', message: `afterCapture failed (${fn.name || `part ${at + 1}`}): ${error?.message ?? error}` }] });
        const answers = fns.map((fn, at) => {
            try {
                const answer = fn(...args);
                return typeof answer?.then === 'function' ? answer.then(undefined, failed(fn, at)) : answer;
            } catch (error) { return failed(fn, at)(error); }
        });
        return answers.some(answer => typeof answer?.then === 'function') ? Promise.all(answers).then(join) : join(answers);
    };
}
