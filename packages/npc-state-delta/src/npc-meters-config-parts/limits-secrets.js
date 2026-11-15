// The length limits of a secret and the sources a note may come from.

export const SECRET_TEXT_MAX = 300;
export const SECRET_TITLE_MAX = 60;
export const SECRET_WHEN_MAX = 120;
// Where a note that is not the reader's came from (its `from`).
export const NOTE_SOURCES = Object.freeze(['pack', 'scan']);
