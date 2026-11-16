// Story Suite v2: the key two change lines share when they are the same line, without decoration.

import { stripDecoration, stripMarkdown } from '../lines.js';

// C-1: a change line written in the story that the reply's blocks also hold (the model wrote it, then
// listed it) is one change: it is taken out of the story and kept in the hidden comment (<Changes-echo>),
// never read. Lines are the same when they are equal without decoration, bold and extra spaces.
export const sameLine = line => stripDecoration(stripMarkdown(line).trim()).trim().replace(/\s+/g, ' ');
/** C-1's matching, for other readers (the Assist extractor): the key two change lines share when they are the same line. */
export const sameChangeLine = line => sameLine(String(line ?? ''));
