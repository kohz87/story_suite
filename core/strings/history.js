// What the reader is told about sealed story history (docs/dev/saves-and-persist.md "Sealed history"): the notices at the edge of the
// retention window, the refusals, and the Tools row. `{window}` is the number of replies kept step by step.
export const HISTORY_STRINGS = {
    sealedDeleted: 'That reply is older than the last {window} replies, so its changes stay in the story.',
    sealedEdited: 'That reply is older than the last {window} replies, so its changes stay in the story; editing it changes only its text.',
    sealedWrite: 'That reply is older than the last {window} replies, so its story changes can\'t be changed any more.',
    sealedReread: 'That reply is older than the last {window} replies, so it can\'t be Re-read.',
    rewindTooFar: 'Return in time reaches back {window} replies. For older points use a save point.',
    branchTooOld: 'This branch starts before the story history this chat keeps, so its story state can\'t be rebuilt here. Branch from a later reply, or use a save point.',
    baseMissing: 'The story history of this chat was tidied, but its saved starting point is missing, so its story state can\'t be rebuilt here. Use a save point.',
    sealSkipped: 'Tidying story history was skipped: the rebuilt story differed from the story as it stands. Nothing was changed.',
    toolsTitle: 'Story history',
    toolsAll: 'Every reply is kept step by step. Once this chat reaches {limit} replies, replies older than the last {window} keep their text and summaries, and their changes can\'t be taken back.',
    toolsSealed: 'The last {window} replies are kept step by step (from message {from}). Older replies keep their text and summaries; their changes can\'t be taken back.',
    toolsOff: 'Tidying story history is off: every reply is kept step by step.',
    toolsSealedOff: 'Tidying is off, so no more replies are tidied; replies already tidied stay so.',
    toolsReadOnly: 'This chat\'s story history can\'t be rebuilt here, so Story Suite reads it only.',
};
