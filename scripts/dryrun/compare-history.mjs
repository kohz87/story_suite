// Which history-operation steps of a recording count as failed: a thrown step, an empty one, a thrown Re-read, a Re-read that
// refused without a code and message. A deliberate refusal (a code and message, nothing thrown) is not a failure; the
// comparison then needs it to be the same on both sides.
function refused(read) {
  const result = read?.result;
  return read?.ok === false && read.code !== 'THREW' && typeof result?.code === 'string' && result.code === read.code && typeof result.message === 'string';
}

function failure(op) {
  if (op?.error) return `threw: ${op.error}`;
  if (op?.skipped) return null;
  if (!op?.headHash) return 'no head state recorded';
  if (op.replyCount > 0 && !op.queries) return 'no queries recorded';
  if (op.replyCount > 0 && !op.reread) return 'no Re-read recorded';
  if (op.reread && op.reread.ok !== true && !refused(op.reread)) return `Re-read failed: ${op.reread.code ?? 'no code'}${op.reread.error ? `: ${op.reread.error}` : ''}`;
  return null;
}

/** Failed steps of `record.history` as `{ reply, field, before, after }`; `side` is "old" or "new". Empty when the record has no history. */
export function historyErrors(record, side) {
  if (!record?.history) return [];
  const ops = Array.isArray(record.history.ops) ? record.history.ops : [];
  if (!ops.length) return [{ reply: null, field: `${side} ERROR history`, before: 'no operations recorded', after: 'a failed step is not a pass' }];
  return ops.flatMap(op => {
    const why = failure(op);
    return why ? [{ reply: null, field: `${side} ERROR history:${op?.op ?? '?'}`, before: why.slice(0, 200), after: 'a failed step is not a pass' }] : [];
  });
}
