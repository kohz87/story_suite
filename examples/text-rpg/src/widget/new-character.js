// The "New character" form as a widget: a name, seven stats bought from 60 points (5 to 15 each) and up to five skills.
//
//   props: {} (none)   api: { command(type, payload) → Promise<result> }
//
// It only collects what the reader typed and sends `textRpg.create`; the command checks it all again.
import { STAT_KEYS } from '../words/stats.js';

const START = { str: 9, vit: 9, agi: 9, dex: 9, int: 8, wis: 8, cha: 8 };
const TOTAL = 60;
const BUY_MIN = 5;
const BUY_MAX = 15;
const SKILL_ROWS = 5;

export function renderNewCharacter(el, props = {}, api = {}) {
    const doc = el.ownerDocument ?? globalThis.document;
    const node = (tag, cls, text) => {
        const n = doc.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    };
    // The suite's own field: a `.ef` label over its input or select (the same classes the wizard and the Journal editor use; a widget has no imports, only class names).
    const field = (role, label, value = '', kind = 'text') => {
        const row = node('label', 'ef', label);
        const input = node(kind === 'select' ? 'select' : 'input');
        if (kind === 'select') {
            for (const key of STAT_KEYS) {
                const option = node('option', null, key.toUpperCase());
                option.setAttribute('value', key);
                input.append(option);
            }
        } else if (kind === 'number') input.setAttribute('type', 'number');
        else input.setAttribute('type', 'text');
        input.setAttribute('data-role', role);
        input.value = value;
        row.append(input);
        return { row, input };
    };

    const root = node('div', 'wz-form tr-new');
    const name = field('name', 'Name');
    const stats = Object.fromEntries(STAT_KEYS.map(key => [key, field(`stat-${key}`, key.toUpperCase(), String(START[key]), 'number')]));
    const skills = Array.from({ length: SKILL_ROWS }, (_, at) => ({
        name: field(`skill-${at}`, `Skill ${at + 1}`),
        stat: field(`skill-stat-${at}`, 'Stat', STAT_KEYS[at % STAT_KEYS.length], 'select'),
        about: field(`skill-about-${at}`, 'What it does'),
    }));
    const left = node('div', 'ps-p tr-left');
    left.setAttribute('data-role', 'left');
    const message = node('div', 'ps-p tr-message');
    message.setAttribute('data-role', 'message');
    const create = node('button', 'btn2 pri', 'Create');
    create.setAttribute('type', 'button');
    create.setAttribute('data-act', 'create');

    const valueOf = key => Number.parseInt(stats[key].input.value, 10) || 0;
    const spent = () => STAT_KEYS.reduce((sum, key) => sum + valueOf(key), 0);
    const inRange = key => valueOf(key) >= BUY_MIN && valueOf(key) <= BUY_MAX;
    const refresh = () => {
        const remaining = TOTAL - spent();
        const n = Math.abs(remaining);
        left.textContent = remaining === 0 ? `All ${TOTAL} points placed.` : `${n} point${n === 1 ? '' : 's'} ${remaining > 0 ? 'left to place' : 'too many'}.`;
        create.disabled = remaining !== 0 || !STAT_KEYS.every(inRange) || !name.input.value.trim();
    };
    for (const key of STAT_KEYS) {
        stats[key].input.setAttribute('min', String(BUY_MIN));
        stats[key].input.setAttribute('max', String(BUY_MAX));
    }
    for (const key of STAT_KEYS) {
        stats[key].input.addEventListener('input', refresh);
        // A stat typed outside 5..15 is brought back into it when the field is left.
        stats[key].input.addEventListener('change', () => {
            if (stats[key].input.value.trim() !== '') stats[key].input.value = String(Math.min(BUY_MAX, Math.max(BUY_MIN, valueOf(key))));
            refresh();
        });
    }
    name.input.addEventListener('input', refresh);
    name.input.addEventListener('change', refresh);

    create.addEventListener('click', async () => {
        const payload = {
            name: name.input.value.trim(),
            stats: Object.fromEntries(STAT_KEYS.map(key => [key, Number.parseInt(stats[key].input.value, 10)])),
            skills: skills.filter(row => row.name.input.value.trim()).map(row => ({ name: row.name.input.value.trim(), stat: row.stat.input.value.trim().toLowerCase(), about: row.about.input.value.trim() })),
        };
        const result = await api.command?.('textRpg.create', payload);
        message.textContent = result?.ok ? `${payload.name} begins the story.` : result?.message ?? 'The character could not be made.';
        // (a host that draws this in a sheet gives `close`: a made character closes it)
        if (result?.ok) api.close?.();
    });

    const statGrid = node('div', 'wz-trio');
    statGrid.append(...STAT_KEYS.map(key => stats[key].row));
    const skillCards = skills.map(row => {
        const card = node('div', 'wz-skill');
        card.append(row.name.row, row.about.row, row.stat.row);
        return card;
    });
    root.append(name.row, node('div', 'ps-sec', 'Stats'), statGrid, left, node('div', 'ps-sec', 'Skills'), ...skillCards, create, message);
    el.replaceChildren(root);
    refresh();
}
