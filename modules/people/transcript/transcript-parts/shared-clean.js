// One chat message cleaned to a `Speaker: text` line (empty for a hidden or empty message).
import { stripUiNoise } from '../../core/core.js';
import { readContext } from './source.js';

export function cleanMessage(message) {
    if (!message || message.is_system) return '';
    const speaker = message.name || (message.is_user ? readContext().name1 : readContext().name2) || '';
    const body = stripUiNoise(message.mes || '');
    return body ? `${speaker}: ${body}` : '';
}
