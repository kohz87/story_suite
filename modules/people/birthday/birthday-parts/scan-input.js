// Birthday fields of a scanner reply: update state and scan birthday normalizing.
import { normalizeBirthDate } from './date.js';

export function normalizeBirthDateState(raw = {}) {
    const value = String(raw?.birthDateState ?? raw?.birth_date_state ?? '').trim().toLowerCase();
    if (value === 'correct' || value === 'correction') return 'correct';
    if (['establish', 'set', 'update', 'refine'].includes(value)) return 'establish';
    return 'keep';
}

export function normalizeScanBirthday(raw = {}, config = undefined) {
    return {
        birthDate: normalizeBirthDate(raw?.birthDate ?? raw?.birth_date ?? raw?.birthday, config),
        birthDateState: normalizeBirthDateState(raw),
        birthDateReason: String(raw?.birthDateReason ?? raw?.birth_date_reason ?? '').trim().slice(0, 500),
    };
}
