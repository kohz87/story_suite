// The block editor's comparison and icon choices.
import { hasIcon } from '../../../../../ui/legacy/view/icons/index.js';
import { S } from './types.js';

export const COMPARISONS = [{ value: 'eq', label: S.is }, { value: 'ne', label: S.isNot }, { value: 'lt', label: S.below },
    { value: 'gt', label: S.above }, { value: 'le', label: S.atMost }, { value: 'ge', label: S.atLeast }];
export const ICONS = ['ph-bookmark-simple', 'ph-scroll', 'ph-heart', 'ph-lightning', 'ph-star', 'ph-sparkle', 'ph-sword', 'ph-skull'].filter(hasIcon);
