// The block editor's label words and its field types.
import { STRINGS } from '../../../../../../../core/strings.js';

export const S = STRINGS.blocks;
export const TYPES = [{ value: 'text', label: S.text }, { value: 'number', label: S.number }, { value: 'choice', label: S.choice }, { value: 'list', label: S.list }, { value: 'entries', label: S.entries }];
// (a part of an entry is a text, a number or a choice; never a list or another list of entries)
export const PART_TYPES = TYPES.slice(0, 3);
