// The last-event record's field limits (note, reason and date length) and the whole-number test.
export const NOTE_MAX = 120;
export const WHY_MAX = 240;   // a story line's own why is cut to 80 where it is read (captureLine); a scan's evidence (withEvidence) may be longer
export const DATE_MAX = 40;
export const wholeInt = value => Number.isSafeInteger(value);
