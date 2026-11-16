// Rollback journal version, window, limit and diagnostic budget constants.

export const ROLLBACK_JOURNAL_VERSION = 2;
export const ROLLBACK_JOURNAL_WINDOW_MESSAGES = 256;
export const ROLLBACK_JOURNAL_LIMIT = 1024;
// Diagnostic target only. The guaranteed raw-message rollback window is never silently
// shortened to satisfy this value; structure-specific undo keeps ordinary journals below it.
export const ROLLBACK_JOURNAL_BUDGET_BYTES = 12_000_000;
