// The like and dislike sign helpers: the sign test, its verb and noun wording and its cap.
import { TASTE_LIMITS, LIKE, DISLIKE } from './shared-limits.js';

export const isSign = sign => sign === LIKE || sign === DISLIKE;
export const verb = sign => (sign === LIKE ? 'likes' : 'dislikes');
export const noun = sign => (sign === LIKE ? 'liking' : 'dislike');
export const limitOf = sign => (sign === LIKE ? TASTE_LIMITS.likes : TASTE_LIMITS.dislikes);
